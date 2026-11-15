-- Minimal stand-in for the parts of Supabase the migrations rely on, so that
-- migrations and Row Level Security can be tested on plain Postgres.
-- NEVER run this against a real Supabase project.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz default now()
);

create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claims', true)::json ->> 'role'
$$;

-- Supabase default: API roles can use the public schema and get broad
-- privileges on new tables (migrations must narrow them).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Test helpers
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
  raise notice 'ok - %', msg;
end $$;

grant execute on function tests.assert(boolean, text) to anon, authenticated, service_role;
