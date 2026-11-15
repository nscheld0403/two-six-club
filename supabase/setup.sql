-- The Two Six Club: complete database setup for a NEW Supabase project.
-- Generated from supabase/migrations by scripts/build-setup-sql.sh. Do not edit by hand.
-- Paste all of this into Supabase > SQL Editor > New query, then click Run.

-- ====================================================================
-- 20261115000100_members_and_auth.sql
-- ====================================================================
-- Phase 1: members, roles, approval workflow, audit trail.
--
-- Authentication model
--   * Every member is a Supabase Auth user. Accounts are created ONLY by the
--     server (service role) during registration, so public sign-ups should be
--     disabled in the Supabase dashboard.
--   * Members sign in with a randomly generated sign-in code. The code holds a
--     public member code (used to derive the auth identity) and a secret access
--     key (the password, hashed by Supabase Auth). The key is never stored by
--     the app.
--   * The admin resets a lost key from the admin dashboard.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums ----
create type public.member_role as enum ('member', 'admin');
create type public.member_status as enum ('pending', 'active', 'suspended', 'declined');
create type public.member_sex as enum ('male', 'female', 'undisclosed');

-- ------------------------------------------------------------- profiles ----
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  member_code text not null unique check (member_code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  age smallint not null check (age between 13 and 100),
  sex public.member_sex not null default 'undisclosed',
  role public.member_role not null default 'member',
  status public.member_status not null default 'pending',
  -- Phase 4: lets a member hide results from other members' leaderboards.
  results_visible boolean not null default true,
  -- Phase 4: lets a member opt in to sex/age leaderboard divisions.
  show_demographics boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  access_reset_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per member. Private: readable by the member and the admin only.';

create index profiles_status_idx on public.profiles (status);

-- ----------------------------------------------------- helper functions ----
-- SECURITY DEFINER so they can read profiles without recursing through RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_active_member() from public;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_member() to authenticated, service_role;

-- ------------------------------------------------------------ audit log ----
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_id uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

-- ------------------------------------------------- privileged-field guard ----
-- Members may edit their own name/age/sex/privacy settings. Only the admin
-- (or server-side service role) may change role, status or member code.
-- SECURITY INVOKER on purpose: current_user must be the calling API role
-- (authenticated / service_role), not the function owner.
create or replace function public.profiles_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_client boolean := current_user in ('authenticated', 'anon');
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'immutable column' using errcode = '42501';
  end if;

  if is_client and not public.is_admin() and (
       new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.member_code is distinct from old.member_code
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.access_reset_at is distinct from old.access_reset_at
     ) then
    raise exception 'only the administrator can change membership fields'
      using errcode = '42501';
  end if;

  -- The admin cannot lock themselves out.
  if is_client and old.id = auth.uid() and old.role = 'admin'
     and (new.role <> 'admin' or new.status <> 'active') then
    raise exception 'the administrator cannot demote or suspend themselves'
      using errcode = '42501';
  end if;

  if new.status = 'active' and old.status <> 'active' then
    new.approved_at := now();
    new.approved_by := coalesce(auth.uid(), new.approved_by);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
before update on public.profiles
for each row execute function public.profiles_before_update();

create or replace function public.profiles_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_log (actor_id, action, target_id, details)
    values (auth.uid(), 'member.status', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.role is distinct from old.role then
    insert into public.audit_log (actor_id, action, target_id, details)
    values (auth.uid(), 'member.role', new.id,
            jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return null;
end;
$$;

create trigger profiles_after_update
after update on public.profiles
for each row execute function public.profiles_after_update();

-- --------------------------------------------- registration rate limit ----
-- Server-only table (service role). Stores a salted hash of the client IP,
-- never the IP itself.
create table public.registration_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index registration_attempts_ip_idx
  on public.registration_attempts (ip_hash, created_at desc);

-- ------------------------------------------------------ session revoke ----
-- Used by the admin "reset access" flow to sign a member out everywhere.
create or replace function public.revoke_member_sessions(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = target;
$$;

revoke all on function public.revoke_member_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_member_sessions(uuid) to service_role;

-- ------------------------------------------------------------------ RLS ----
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.registration_attempts enable row level security;

-- Supabase grants broad table privileges to anon/authenticated by default.
-- Narrow them explicitly; RLS then filters rows.
revoke all on public.profiles, public.audit_log, public.registration_attempts from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, age, sex, results_visible, show_demographics,
              role, status, last_seen_at)
  on public.profiles to authenticated;
grant select on public.audit_log to authenticated;

grant all on public.profiles, public.audit_log, public.registration_attempts to service_role;

create policy "members read own profile; admin reads all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "members update own profile; admin updates all"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "admin reads audit log"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- registration_attempts: no policies => only service role can touch it.

-- ====================================================================
-- 20261116000200_scheduling.sql
-- ====================================================================
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

-- ====================================================================
-- 20261116000300_results_and_leaderboards.sql
-- ====================================================================
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

-- ====================================================================
-- 20261116000400_hardening.sql
-- ====================================================================
-- Hardening from the Supabase security advisor.
-- Supabase grants EXECUTE on new functions directly to anon/authenticated,
-- so "revoke ... from public" alone is not enough.

-- Helpers used by RLS: signed-in only.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_active_member() from anon;
revoke execute on function public.club_timezone() from public, anon;
grant execute on function public.club_timezone() to authenticated, service_role;

-- Trigger functions are never called directly (EXECUTE is only checked when
-- the trigger is created, not when it fires).
revoke execute on function public.profiles_before_update() from public, anon, authenticated;
revoke execute on function public.profiles_after_update() from public, anon, authenticated;
revoke execute on function public.reservations_before_write() from public, anon, authenticated;
revoke execute on function public.reservations_immutable_keys() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.results_before_write() from public, anon, authenticated;

-- Pin search_path on the remaining helpers.
alter function public.current_age(public.profiles) set search_path = '';
alter function public.workout_is_visible(public.workouts) set search_path = '';

-- ====================================================================
-- 20261116000500_birthdays.sql
-- ====================================================================
-- Birthdays replace typed-in ages. Age is derived from the birthday, so it
-- stays correct over time, and classes can show a cake on someone's birthday.
-- Other members only ever learn "it's their birthday today", never the date.

alter table public.profiles
  add column birth_date date check (birth_date >= date '1900-01-01');

comment on column public.profiles.birth_date is 'Private: visible to the member and the admin only.';

-- Keep the stored age in step with the birthday.
create or replace function public.profiles_sync_age()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null
     and (tg_op = 'INSERT' or new.birth_date is distinct from old.birth_date) then
    new.age := extract(year from age(current_date, new.birth_date))::int;
    new.age_recorded_on := current_date;
  end if;
  return new;
end;
$$;

create trigger profiles_sync_age
before insert or update on public.profiles
for each row execute function public.profiles_sync_age();

revoke execute on function public.profiles_sync_age() from public, anon, authenticated;

-- Exact age from the birthday when known; otherwise the age entered at sign-up, aged forward.
create or replace function public.current_age(p public.profiles)
returns int
language sql
stable
set search_path = ''
as $$
  select case
    when p.birth_date is not null then extract(year from age(current_date, p.birth_date))::int
    else p.age + extract(year from age(current_date, p.age_recorded_on))::int
  end;
$$;

-- Is day d someone's birthday? Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
create or replace function public.is_birthday_on(b date, d date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select b is not null and (
    (extract(month from b) = extract(month from d) and extract(day from b) = extract(day from d))
    or (
      extract(month from b) = 2 and extract(day from b) = 29
      and extract(month from d) = 2 and extract(day from d) = 28
      and not (extract(year from d)::int % 4 = 0
               and (extract(year from d)::int % 100 <> 0 or extract(year from d)::int % 400 = 0))
    )
  );
$$;

-- Members may set their own birthday (the guard trigger still protects role/status).
grant update (birth_date) on public.profiles to authenticated;

-- Attendee list gains a birthday flag (no dates exposed).
drop function public.session_attendees(uuid);
create function public.session_attendees(p_session uuid)
returns table (member_id uuid, display_name text, status public.rsvp_status, is_birthday boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, r.status,
         public.is_birthday_on(p.birth_date, (s.starts_at at time zone public.club_timezone())::date)
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
revoke all on function public.session_attendees(uuid) from public, anon;
grant execute on function public.session_attendees(uuid) to authenticated;

-- Schedule gains a count of birthdays among the people going.
drop function public.member_schedule(timestamptz, timestamptz);
create function public.member_schedule(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, title text, kind public.session_kind, discipline public.discipline,
  starts_at timestamptz, duration_min smallint, capacity smallint, coach_label text,
  status public.session_status, workout_id uuid, workout_title text,
  going_count int, maybe_count int, my_status public.rsvp_status, birthday_count int
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
         (select r.status from public.reservations r where r.session_id = s.id and r.member_id = auth.uid()),
         (select count(*)::int from public.reservations r join public.profiles p on p.id = r.member_id
           where r.session_id = s.id and r.status in ('going', 'maybe') and p.status = 'active'
             and public.is_birthday_on(p.birth_date, (s.starts_at at time zone public.club_timezone())::date))
  from public.class_sessions s
  left join public.workouts w on w.id = s.workout_id
  where public.is_active_member()
    and s.published
    and s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at;
$$;
revoke all on function public.member_schedule(timestamptz, timestamptz) from public, anon;
grant execute on function public.member_schedule(timestamptz, timestamptz) to authenticated;
