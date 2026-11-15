-- Phases 3-4: workout results, strength sets, personal records, leaderboards
-- and analytics views. All analytics are computed from the raw results, so
-- they stay correct as data grows (no denormalised totals to drift).

create table public.results (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  section_id uuid references public.workout_sections (id) on delete set null,
  session_id uuid references public.class_sessions (id) on delete set null,
  performed_on date not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  scoring public.scoring_type not null check (scoring <> 'none'),
  movement_id uuid references public.movements (id) on delete set null,
  benchmark_name text check (char_length(benchmark_name) <= 60),
  level smallint check (level in (1, 2)),
  rx boolean not null default false,
  time_seconds int check (time_seconds between 1 and 86400),
  capped boolean not null default false,
  rounds int check (rounds between 0 and 999),
  reps int check (reps between 0 and 99999),
  load_lbs numeric(6, 1) check (load_lbs > 0 and load_lbs < 2000),
  distance_m numeric(9, 1) check (distance_m > 0),
  calories int check (calories between 1 and 99999),
  rpe smallint check (rpe between 1 and 10),
  notes text check (char_length(notes) <= 1000),
  score_value numeric,          -- computed: higher is always better
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index results_one_per_section on public.results (member_id, section_id) where section_id is not null;
create index results_member_date_idx on public.results (member_id, performed_on desc);
create index results_section_idx on public.results (section_id, score_value desc);
create index results_movement_idx on public.results (member_id, movement_id) where movement_id is not null;
create index results_benchmark_idx on public.results (lower(benchmark_name), score_value desc) where benchmark_name is not null;

create table public.result_sets (
  result_id uuid not null references public.results (id) on delete cascade,
  set_no smallint not null check (set_no between 1 and 50),
  reps smallint not null check (reps between 1 and 100),
  load_lbs numeric(6, 1) not null check (load_lbs >= 0 and load_lbs < 2000),
  primary key (result_id, set_no)
);

-- --------------------------------------------------------------- scoring ----
-- Normalises every scoring type to one number where higher is better.
--   for_time / time_trial : 10,000,000 - seconds (finishers always beat capped)
--   for_time capped       : reps completed
--   amrap / emom          : rounds * 1000 + reps
--   max_weight / sets_reps: heaviest load (lb)
--   max_reps              : reps
--   distance              : metres
--   calories              : calories
create or replace function public.results_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scoring in ('for_time', 'time_trial') then
    if new.scoring = 'for_time' and new.capped then
      if new.reps is null then raise exception 'reps completed at the cap are required' using errcode = '23514'; end if;
      new.time_seconds := null;
      new.score_value := new.reps;
    else
      if new.time_seconds is null then raise exception 'a time is required' using errcode = '23514'; end if;
      new.capped := false;
      new.score_value := 10000000 - new.time_seconds;
    end if;
    if new.scoring = 'time_trial' and new.distance_m is null then
      raise exception 'distance is required for a time trial' using errcode = '23514';
    end if;
  elsif new.scoring in ('amrap', 'emom') then
    if new.rounds is null and new.reps is null then
      raise exception 'rounds or reps are required' using errcode = '23514';
    end if;
    new.score_value := coalesce(new.rounds, 0) * 1000 + coalesce(new.reps, 0);
  elsif new.scoring in ('max_weight', 'sets_reps') then
    -- load_lbs holds the heaviest set; the app keeps it in sync with result_sets
    if new.load_lbs is null then raise exception 'a load is required' using errcode = '23514'; end if;
    new.score_value := new.load_lbs;
  elsif new.scoring = 'max_reps' then
    if new.reps is null then raise exception 'reps are required' using errcode = '23514'; end if;
    new.score_value := new.reps;
  elsif new.scoring = 'distance' then
    if new.distance_m is null then raise exception 'a distance is required' using errcode = '23514'; end if;
    new.score_value := new.distance_m;
  elsif new.scoring = 'calories' then
    if new.calories is null then raise exception 'calories are required' using errcode = '23514'; end if;
    new.score_value := new.calories;
  end if;

  if tg_op = 'UPDATE' and new.member_id <> old.member_id then
    raise exception 'results cannot change owner' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger results_before_write
before insert or update on public.results
for each row execute function public.results_before_write();

-- ------------------------------------------------------------------ RLS ----
alter table public.results enable row level security;
alter table public.result_sets enable row level security;
revoke all on public.results, public.result_sets from anon, authenticated;
grant select, insert, update, delete on public.results, public.result_sets to authenticated;
grant all on public.results, public.result_sets to service_role;

create policy "members read own results; admin all" on public.results for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));
create policy "active members log own results" on public.results for insert to authenticated
  with check ((select public.is_active_member()) and member_id = (select auth.uid()));
create policy "members edit own results" on public.results for update to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()))
  with check (((select public.is_active_member()) and member_id = (select auth.uid())) or (select public.is_admin()));
create policy "members delete own results" on public.results for delete to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

create policy "sets follow their result" on public.result_sets for all to authenticated
  using (exists (select 1 from public.results r where r.id = result_id
                 and (r.member_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.results r where r.id = result_id
                 and ((r.member_id = (select auth.uid()) and (select public.is_active_member())) or (select public.is_admin()))));

-- ------------------------------------------------------- analytics views ----
-- security_invoker: callers only see rows RLS lets them see (their own).

-- Best load per movement and rep count (1RM, 3RM, 5RM...).
create view public.lift_bests with (security_invoker = true) as
select distinct on (r.member_id, r.movement_id, s.reps)
  r.member_id, r.movement_id, m.name as movement_name, s.reps, s.load_lbs, r.performed_on, r.id as result_id
from public.result_sets s
join public.results r on r.id = s.result_id
join public.movements m on m.id = r.movement_id
where s.load_lbs > 0
order by r.member_id, r.movement_id, s.reps, s.load_lbs desc, r.performed_on asc;

-- Estimated 1RM per movement per day (Epley; sets of 1-10 reps only).
create view public.e1rm_daily with (security_invoker = true) as
select r.member_id, r.movement_id, m.name as movement_name, r.performed_on,
       round(max(case when s.reps = 1 then s.load_lbs else s.load_lbs * (1 + s.reps / 30.0) end), 1) as e1rm_lbs,
       max(s.load_lbs) as top_load_lbs,
       sum(s.reps * s.load_lbs) as volume_lbs
from public.result_sets s
join public.results r on r.id = s.result_id
join public.movements m on m.id = r.movement_id
where s.reps between 1 and 10 and s.load_lbs > 0
group by r.member_id, r.movement_id, m.name, r.performed_on;

-- Best result per benchmark (Fran, 2k Row, ...), per scaling.
create view public.benchmark_bests with (security_invoker = true) as
select distinct on (r.member_id, lower(r.benchmark_name), r.rx)
  r.member_id, r.benchmark_name, r.rx, r.scoring, r.score_value, r.time_seconds, r.capped,
  r.rounds, r.reps, r.load_lbs, r.distance_m, r.calories, r.performed_on, r.id as result_id
from public.results r
where r.benchmark_name is not null
order by r.member_id, lower(r.benchmark_name), r.rx, r.score_value desc, r.performed_on asc;

grant select on public.lift_bests, public.e1rm_daily, public.benchmark_bests to authenticated;

-- --------------------------------------------------------- leaderboards ----
-- Returns every visible result for one workout section. Other members appear
-- only if they are active and have results_visible on; sex/age group are
-- returned only for members who opted in to demographic divisions.
create or replace function public.section_leaderboard(p_section uuid)
returns table (
  result_id uuid, member_id uuid, display_name text, is_me boolean,
  level smallint, rx boolean, score_value numeric, time_seconds int, capped boolean,
  rounds int, reps int, load_lbs numeric, distance_m numeric, calories int,
  sex public.member_sex, age_group text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.id, p.display_name, p.id = auth.uid(),
         r.level, r.rx, r.score_value, r.time_seconds, r.capped,
         r.rounds, r.reps, r.load_lbs, r.distance_m, r.calories,
         case when p.show_demographics and p.sex <> 'undisclosed' then p.sex end,
         case when p.show_demographics then
           case
             when public.current_age(p) < 30 then 'Under 30'
             when public.current_age(p) < 40 then '30–39'
             when public.current_age(p) < 50 then '40–49'
             else '50+'
           end
         end
  from public.results r
  join public.profiles p on p.id = r.member_id
  join public.workout_sections ws on ws.id = r.section_id
  join public.workouts w on w.id = ws.workout_id
  where public.is_active_member()
    and r.section_id = p_section
    and (public.is_admin() or public.workout_is_visible(w))
    and (p.id = auth.uid() or public.is_admin() or (p.status = 'active' and p.results_visible))
  order by r.rx desc, r.level desc nulls last, r.score_value desc;
$$;

-- All-time board for a named benchmark across every time it was programmed.
create or replace function public.benchmark_leaderboard(p_benchmark text)
returns table (
  result_id uuid, member_id uuid, display_name text, is_me boolean, performed_on date,
  level smallint, rx boolean, scoring public.scoring_type, score_value numeric, time_seconds int,
  capped boolean, rounds int, reps int, load_lbs numeric, distance_m numeric, calories int,
  sex public.member_sex, age_group text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (p.id, r.rx)
         r.id, p.id, p.display_name, p.id = auth.uid(), r.performed_on,
         r.level, r.rx, r.scoring, r.score_value, r.time_seconds, r.capped,
         r.rounds, r.reps, r.load_lbs, r.distance_m, r.calories,
         case when p.show_demographics and p.sex <> 'undisclosed' then p.sex end,
         case when p.show_demographics then
           case
             when public.current_age(p) < 30 then 'Under 30'
             when public.current_age(p) < 40 then '30–39'
             when public.current_age(p) < 50 then '40–49'
             else '50+'
           end
         end
  from public.results r
  join public.profiles p on p.id = r.member_id
  where public.is_active_member()
    and lower(r.benchmark_name) = lower(p_benchmark)
    and (p.id = auth.uid() or public.is_admin() or (p.status = 'active' and p.results_visible))
  order by p.id, r.rx, r.score_value desc, r.performed_on;
$$;

-- Names of benchmarks members have logged (for the leaderboard picker).
create or replace function public.benchmark_names()
returns table (benchmark_name text, entries int)
language sql
stable
security definer
set search_path = ''
as $$
  select min(r.benchmark_name), count(*)::int
  from public.results r
  join public.profiles p on p.id = r.member_id
  where public.is_active_member() and r.benchmark_name is not null
    and (p.id = auth.uid() or public.is_admin() or (p.status = 'active' and p.results_visible))
  group by lower(r.benchmark_name)
  order by 1;
$$;

revoke all on function public.section_leaderboard(uuid) from public, anon;
revoke all on function public.benchmark_leaderboard(text) from public, anon;
revoke all on function public.benchmark_names() from public, anon;
grant execute on function public.section_leaderboard(uuid) to authenticated;
grant execute on function public.benchmark_leaderboard(text) to authenticated;
grant execute on function public.benchmark_names() to authenticated;

-- Signed-out visitors never need the analytics views.
revoke all on public.lift_bests, public.e1rm_daily, public.benchmark_bests from anon;
