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
