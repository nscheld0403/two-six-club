-- Phase 2: club settings, workouts & templates, class schedule, recurring
-- sessions, open gym, reservations (RSVP) and attendance.

-- ------------------------------------------------------------- settings ----
create table public.club_settings (
  id boolean primary key default true check (id),           -- single row
  timezone text not null default 'America/New_York',
  default_capacity smallint not null default 10 check (default_capacity between 1 and 200),
  updated_at timestamptz not null default now()
);
insert into public.club_settings default values;

create or replace function public.club_timezone()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select timezone from public.club_settings where id), 'America/New_York');
$$;

-- Age entered at sign-up ages with the member: keep the date it was recorded.
alter table public.profiles add column age_recorded_on date not null default current_date;

create or replace function public.current_age(p public.profiles)
returns int language sql stable as $$
  select p.age + (extract(year from age(current_date, p.age_recorded_on)))::int;
$$;

-- ---------------------------------------------------------------- enums ----
create type public.discipline as enum ('crossfit', 'hyrox', 'strength', 'conditioning', 'mobility', 'open_gym');
create type public.session_kind as enum ('class', 'open_gym');
create type public.session_status as enum ('scheduled', 'cancelled');
create type public.workout_status as enum ('draft', 'published');
create type public.section_kind as enum ('warmup', 'strength', 'conditioning', 'skill', 'accessory', 'cooldown');
create type public.scoring_type as enum (
  'none',          -- not scored (warm-up, cooldown)
  'for_time',      -- lowest time wins; capped athletes ranked by reps
  'amrap',         -- rounds + reps, most wins
  'emom',          -- total reps / rounds completed, most wins
  'max_weight',    -- heaviest load wins (e.g. 3RM)
  'max_reps',      -- most reps wins
  'distance',      -- longest distance in a fixed time
  'time_trial',    -- fixed distance, lowest time wins (pace derived)
  'calories',      -- most calories
  'sets_reps'      -- strength work: sets x reps @ load, top set compared
);
create type public.rsvp_status as enum ('going', 'maybe', 'not_going');

-- ------------------------------------------------------------ movements ----
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  category text not null default 'barbell' check (category in ('barbell', 'dumbbell', 'kettlebell', 'gymnastics', 'monostructural', 'other')),
  created_at timestamptz not null default now()
);

insert into public.movements (name, category) values
  ('Back Squat', 'barbell'), ('Front Squat', 'barbell'), ('Overhead Squat', 'barbell'),
  ('Deadlift', 'barbell'), ('Sumo Deadlift', 'barbell'), ('Romanian Deadlift', 'barbell'),
  ('Bench Press', 'barbell'), ('Strict Press', 'barbell'), ('Push Press', 'barbell'), ('Push Jerk', 'barbell'),
  ('Split Jerk', 'barbell'), ('Clean', 'barbell'), ('Power Clean', 'barbell'), ('Hang Clean', 'barbell'),
  ('Clean & Jerk', 'barbell'), ('Snatch', 'barbell'), ('Power Snatch', 'barbell'), ('Hang Snatch', 'barbell'),
  ('Thruster', 'barbell'), ('Hip Thrust', 'barbell'),
  ('Weighted Pull-up', 'gymnastics'), ('Strict Pull-up', 'gymnastics'), ('Pull-up', 'gymnastics'),
  ('Push-up', 'gymnastics'), ('Handstand Push-up', 'gymnastics'), ('Muscle-up', 'gymnastics'),
  ('Row', 'monostructural'), ('Run', 'monostructural'), ('Bike Erg', 'monostructural'),
  ('Ski Erg', 'monostructural'), ('Assault Bike', 'monostructural'),
  ('Sled Push', 'other'), ('Sled Pull', 'other'), ('Wall Ball', 'other'), ('Sandbag Lunge', 'other'),
  ('Farmers Carry', 'other'), ('Burpee Broad Jump', 'gymnastics');

-- ------------------------------------------------------------- workouts ----
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  workout_date date,                         -- null for templates
  discipline public.discipline not null default 'crossfit',
  summary text check (char_length(summary) <= 500),
  coach_notes text check (char_length(coach_notes) <= 2000),
  status public.workout_status not null default 'draft',
  publish_at timestamptz,                    -- optional delayed reveal
  is_template boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_template or workout_date is not null)
);
create index workouts_date_idx on public.workouts (workout_date) where not is_template;

create table public.workout_sections (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  position smallint not null default 0,
  kind public.section_kind not null default 'conditioning',
  title text not null check (char_length(btrim(title)) between 1 and 80),
  scoring public.scoring_type not null default 'none',
  movement_id uuid references public.movements (id) on delete set null,  -- strength / max lifts
  benchmark_name text check (char_length(benchmark_name) <= 60),         -- e.g. 'Fran', '2k Row'
  time_cap_seconds int check (time_cap_seconds > 0),
  rounds_target smallint check (rounds_target > 0),
  reps_per_round smallint check (reps_per_round > 0),
  distance_m numeric(8, 1) check (distance_m > 0),
  level1 text check (char_length(level1) <= 2000),
  level2 text check (char_length(level2) <= 2000),
  notes text check (char_length(notes) <= 1000)
);
create index workout_sections_workout_idx on public.workout_sections (workout_id, position);
create index workout_sections_benchmark_idx on public.workout_sections (lower(benchmark_name)) where benchmark_name is not null;

-- --------------------------------------------------------------- series ----
create table public.session_series (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  kind public.session_kind not null default 'class',
  discipline public.discipline not null default 'crossfit',
  weekday smallint not null check (weekday between 1 and 7),   -- ISO: 1 = Monday
  start_time time not null,
  duration_min smallint not null default 60 check (duration_min between 10 and 300),
  capacity smallint not null default 10 check (capacity between 1 and 200),
  coach_label text check (char_length(coach_label) <= 40),
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

-- ------------------------------------------------------------- sessions ----
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  kind public.session_kind not null default 'class',
  discipline public.discipline not null default 'crossfit',
  starts_at timestamptz not null,
  duration_min smallint not null default 60 check (duration_min between 10 and 300),
  capacity smallint not null default 10 check (capacity between 1 and 200),
  coach_label text check (char_length(coach_label) <= 40),
  workout_id uuid references public.workouts (id) on delete set null,
  series_id uuid references public.session_series (id) on delete set null,
  status public.session_status not null default 'scheduled',
  published boolean not null default false,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, starts_at)
);
create index class_sessions_starts_idx on public.class_sessions (starts_at);

-- --------------------------------------------------------- reservations ----
create table public.reservations (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null,
  attended boolean,                           -- set by the admin (null = not recorded)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, member_id)
);
create index reservations_member_idx on public.reservations (member_id, session_id);

-- -------------------------------------------------------- visibility ----
create or replace function public.workout_is_visible(w public.workouts)
returns boolean language sql stable as $$
  select not w.is_template and w.status = 'published' and (w.publish_at is null or w.publish_at <= now());
$$;

-- --------------------------------------------------- reservation rules ----
-- Members can RSVP to published, scheduled sessions that haven't finished,
-- and 'going' is capped at the session's capacity.
--
-- The checks need to see the session row (members can't lock it) and every
-- member's RSVPs (members can only read their own), so they live in a
-- SECURITY DEFINER helper in the non-API "private" schema. Locking the
-- session row serialises concurrent RSVPs so capacity can't be exceeded.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.rsvp_session_state(p_session uuid, p_member uuid)
returns table (published boolean, status public.session_status, ends_at timestamptz, capacity smallint, going_others int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.class_sessions where id = p_session for update;
  return query
    select s.published, s.status, s.starts_at + make_interval(mins => s.duration_min), s.capacity,
           (select count(*)::int from public.reservations r
             where r.session_id = s.id and r.status = 'going' and r.member_id <> p_member)
    from public.class_sessions s where s.id = p_session;
end;
$$;
revoke all on function private.rsvp_session_state(uuid, uuid) from public;
grant execute on function private.rsvp_session_state(uuid, uuid) to authenticated, service_role;

create or replace function public.reservations_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  st record;
  admin boolean := public.is_admin();
  is_client boolean := current_user in ('authenticated', 'anon');
begin
  select * into st from private.rsvp_session_state(new.session_id, new.member_id);
  if st is null or st.capacity is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if is_client and not admin then
    if (tg_op = 'UPDATE' and new.attended is distinct from old.attended)
       or (tg_op = 'INSERT' and new.attended is not null) then
      raise exception 'only the administrator records attendance' using errcode = '42501';
    end if;
    if not st.published or st.status <> 'scheduled' then
      raise exception 'this session is not open for RSVPs' using errcode = '22023';
    end if;
    if st.ends_at < now() then
      raise exception 'this session has already happened' using errcode = '22023';
    end if;
  end if;

  if new.status = 'going' and (tg_op = 'INSERT' or old.status <> 'going') and st.going_others >= st.capacity then
    raise exception 'class is full' using errcode = '23P01', hint = 'full';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger reservations_before_write
before insert or update on public.reservations
for each row execute function public.reservations_before_write();

-- Members may never move their reservation to another session or person.
create or replace function public.reservations_immutable_keys()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.session_id <> old.session_id or new.member_id <> old.member_id then
    raise exception 'immutable reservation keys' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger reservations_immutable_keys before update on public.reservations
for each row execute function public.reservations_immutable_keys();

-- ------------------------------------------------- touch updated_at ----
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger workouts_touch before update on public.workouts
for each row execute function public.touch_updated_at();
create trigger class_sessions_touch before update on public.class_sessions
for each row execute function public.touch_updated_at();

-- ---------------------------------------------- recurring generation ----
-- Creates the series' sessions from its start date up to p_until (inclusive),
-- skipping ones that already exist. Returns the number created.
create or replace function public.generate_series_sessions(p_series uuid, p_until date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ser public.session_series;
  tz text := public.club_timezone();
  d date;
  first_day date;
  created int := 0;
  last_day date;
begin
  if not public.is_admin() and current_user in ('authenticated', 'anon') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select * into ser from public.session_series where id = p_series;
  if not found then raise exception 'series not found'; end if;

  last_day := least(p_until, coalesce(ser.ends_on, p_until));
  -- first date on/after starts_on (and not in the past) that falls on the weekday
  first_day := greatest(ser.starts_on, (now() at time zone tz)::date);
  first_day := first_day + ((ser.weekday - extract(isodow from first_day)::int + 7) % 7);

  d := first_day;
  while d <= last_day loop
    insert into public.class_sessions
      (title, kind, discipline, starts_at, duration_min, capacity, coach_label, series_id, published)
    values
      (ser.title, ser.kind, ser.discipline, (d + ser.start_time) at time zone tz,
       ser.duration_min, ser.capacity, ser.coach_label, ser.id, true)
    on conflict (series_id, starts_at) do nothing;
    if found then created := created + 1; end if;
    d := d + 7;
  end loop;
  return created;
end;
$$;

-- --------------------------------------------------- duplicate a week ----
-- Copies every session (and, optionally, workout) from the week starting
-- p_from (a Monday) to the week starting p_to. Copied workouts are drafts.
create or replace function public.duplicate_week(p_from date, p_to date, p_include_workouts boolean default true)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tz text := public.club_timezone();
  shift int := p_to - p_from;
  w record;
  new_id uuid;
  copied int := 0;
  map jsonb := '{}'::jsonb;
begin
  if not public.is_admin() and current_user in ('authenticated', 'anon') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if extract(isodow from p_from) <> 1 or extract(isodow from p_to) <> 1 then
    raise exception 'weeks must start on a Monday' using errcode = '22023';
  end if;

  if p_include_workouts then
    for w in
      select * from public.workouts
      where not is_template and workout_date between p_from and p_from + 6
    loop
      insert into public.workouts (title, workout_date, discipline, summary, coach_notes, status, created_by)
      values (w.title, w.workout_date + shift, w.discipline, w.summary, w.coach_notes, 'draft', auth.uid())
      returning id into new_id;
      insert into public.workout_sections
        (workout_id, position, kind, title, scoring, movement_id, benchmark_name, time_cap_seconds,
         rounds_target, reps_per_round, distance_m, level1, level2, notes)
      select new_id, position, kind, title, scoring, movement_id, benchmark_name, time_cap_seconds,
             rounds_target, reps_per_round, distance_m, level1, level2, notes
      from public.workout_sections where workout_id = w.id;
      map := map || jsonb_build_object(w.id::text, new_id);
    end loop;
  end if;

  insert into public.class_sessions
    (title, kind, discipline, starts_at, duration_min, capacity, coach_label, workout_id, status, published, notes)
  select s.title, s.kind, s.discipline,
         ((s.starts_at at time zone tz) + make_interval(days => shift)) at time zone tz,
         s.duration_min, s.capacity, s.coach_label,
         case when p_include_workouts then (map ->> s.workout_id::text)::uuid end,
         'scheduled', false, s.notes
  from public.class_sessions s
  where (s.starts_at at time zone tz)::date between p_from and p_from + 6
    and s.status = 'scheduled'
    and s.series_id is null;          -- recurring sessions generate themselves
  get diagnostics copied = row_count;
  return copied;
end;
$$;

-- ------------------------------------------------------ member schedule ----
-- Week view for members: published sessions with counts and the caller's
-- own RSVP. Attendee identities are exposed separately (names only).
create or replace function public.member_schedule(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, title text, kind public.session_kind, discipline public.discipline,
  starts_at timestamptz, duration_min smallint, capacity smallint, coach_label text,
  status public.session_status, workout_id uuid, workout_title text,
  going_count int, maybe_count int, my_status public.rsvp_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.kind, s.discipline, s.starts_at, s.duration_min, s.capacity, s.coach_label,
         s.status,
         case when public.workout_is_visible(w) then w.id end,
         case when public.workout_is_visible(w) then w.title end,
         (select count(*)::int from public.reservations r where r.session_id = s.id and r.status = 'going'),
         (select count(*)::int from public.reservations r where r.session_id = s.id and r.status = 'maybe'),
         (select r.status from public.reservations r where r.session_id = s.id and r.member_id = auth.uid())
  from public.class_sessions s
  left join public.workouts w on w.id = s.workout_id
  where public.is_active_member()
    and s.published
    and s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at;
$$;

create or replace function public.session_attendees(p_session uuid)
returns table (member_id uuid, display_name text, status public.rsvp_status)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, r.status
  from public.reservations r
  join public.profiles p on p.id = r.member_id
  join public.class_sessions s on s.id = r.session_id
  where public.is_active_member()
    and s.published
    and r.session_id = p_session
    and r.status in ('going', 'maybe')
    and p.status = 'active'
  order by r.status, r.created_at;
$$;

revoke all on function public.member_schedule(timestamptz, timestamptz) from public, anon;
revoke all on function public.session_attendees(uuid) from public, anon;
revoke all on function public.generate_series_sessions(uuid, date) from public, anon;
revoke all on function public.duplicate_week(date, date, boolean) from public, anon;
grant execute on function public.member_schedule(timestamptz, timestamptz) to authenticated;
grant execute on function public.session_attendees(uuid) to authenticated;
grant execute on function public.generate_series_sessions(uuid, date) to authenticated, service_role;
grant execute on function public.duplicate_week(date, date, boolean) to authenticated, service_role;

-- ------------------------------------------------------------------ RLS ----
alter table public.club_settings enable row level security;
alter table public.movements enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sections enable row level security;
alter table public.session_series enable row level security;
alter table public.class_sessions enable row level security;
alter table public.reservations enable row level security;

revoke all on public.club_settings, public.movements, public.workouts, public.workout_sections,
  public.session_series, public.class_sessions, public.reservations from anon, authenticated;

grant select, update on public.club_settings to authenticated;
grant select, insert, update, delete on public.movements, public.workouts, public.workout_sections,
  public.session_series, public.class_sessions to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;
grant all on public.club_settings, public.movements, public.workouts, public.workout_sections,
  public.session_series, public.class_sessions, public.reservations to service_role;

-- settings
create policy "members read settings" on public.club_settings for select to authenticated
  using ((select public.is_active_member()));
create policy "admin updates settings" on public.club_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- movements
create policy "members read movements" on public.movements for select to authenticated
  using ((select public.is_active_member()));
create policy "admin manages movements" on public.movements for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- workouts & sections
create policy "members read published workouts" on public.workouts for select to authenticated
  using ((select public.is_active_member()) and public.workout_is_visible(workouts));
create policy "admin manages workouts" on public.workouts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "members read sections of published workouts" on public.workout_sections for select to authenticated
  using (
    (select public.is_active_member())
    and exists (select 1 from public.workouts w where w.id = workout_id and public.workout_is_visible(w))
  );
create policy "admin manages sections" on public.workout_sections for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- series (admin only)
create policy "admin manages series" on public.session_series for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- sessions
create policy "members read published sessions" on public.class_sessions for select to authenticated
  using ((select public.is_active_member()) and published);
create policy "admin manages sessions" on public.class_sessions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- reservations
create policy "members read own reservations" on public.reservations for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));
create policy "members create own reservations" on public.reservations for insert to authenticated
  with check (
    ((select public.is_active_member()) and member_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy "members update own reservations" on public.reservations for update to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()))
  with check (
    ((select public.is_active_member()) and member_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy "members delete own reservations; admin any" on public.reservations for delete to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));
