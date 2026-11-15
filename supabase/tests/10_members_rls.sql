-- Phase 1 RLS tests: profiles, audit log, registration attempts.
\set ON_ERROR_STOP on

-- Fixtures (as superuser) ---------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'active@test'),
  ('00000000-0000-0000-0000-0000000000c1', 'pending@test');

insert into public.profiles (id, member_code, display_name, age, sex, role, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'ADM1N0', 'Test Admin', 40, 'undisclosed', 'admin', 'active'),
  ('00000000-0000-0000-0000-0000000000b1', 'ACT1VE', 'Active Member', 30, 'female', 'member', 'active'),
  ('00000000-0000-0000-0000-0000000000c1', 'PEND1N', 'Pending Member', 25, 'male', 'member', 'pending');

insert into auth.sessions (user_id) values ('00000000-0000-0000-0000-0000000000b1');

-- Anonymous visitors ----------------------------------------------------------
set role anon;
do $$ begin
  perform 1 from public.profiles;
  raise exception 'anon could read profiles';
exception when insufficient_privilege then
  perform tests.assert(true, 'anon cannot read profiles');
end $$;
reset role;

-- Pending member --------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select tests.assert((select count(*) from public.profiles) = 1, 'pending member sees only own profile');
select tests.assert(not public.is_active_member(), 'pending member is not active');
select tests.assert(not public.is_admin(), 'pending member is not admin');

update public.profiles set display_name = 'Renamed Pending' where id = auth.uid();
select tests.assert((select display_name from public.profiles where id = auth.uid()) = 'Renamed Pending',
  'member can edit own display name');

do $$ begin
  update public.profiles set status = 'active' where id = auth.uid();
  raise exception 'pending member self-approved';
exception when insufficient_privilege then
  perform tests.assert(true, 'member cannot approve themselves');
end $$;

do $$ begin
  update public.profiles set role = 'admin' where id = auth.uid();
  raise exception 'member made themselves admin';
exception when insufficient_privilege then
  perform tests.assert(true, 'member cannot grant themselves admin');
end $$;

do $$ begin
  update public.profiles set member_code = 'ZZZZZZ' where id = auth.uid();
  raise exception 'member changed member code';
exception when insufficient_privilege then
  perform tests.assert(true, 'member cannot change member code');
end $$;

do $$ begin
  perform 1 from public.audit_log;
  perform tests.assert((select count(*) from public.audit_log) = 0, 'member sees no audit log rows');
end $$;

do $$ begin
  perform 1 from public.registration_attempts;
  raise exception 'member could read registration attempts';
exception when insufficient_privilege then
  perform tests.assert(true, 'member cannot read registration attempts');
end $$;

do $$ begin
  insert into public.profiles (id, member_code, display_name, age)
  values (gen_random_uuid(), 'NEWNEW', 'Sneaky', 30);
  raise exception 'member inserted a profile';
exception when insufficient_privilege then
  perform tests.assert(true, 'member cannot insert profiles');
end $$;

do $$ begin
  perform public.revoke_member_sessions('00000000-0000-0000-0000-0000000000b1');
  raise exception 'member revoked sessions';
exception when insufficient_privilege then
  perform tests.assert(true, 'member cannot revoke sessions');
end $$;

-- Active member -----------------------------------------------------------------
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select tests.assert((select count(*) from public.profiles) = 1, 'active member cannot see other members'' private profiles');
select tests.assert(public.is_active_member(), 'active member is active');

with u as (
  update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000c1' returning 1
) select tests.assert((select count(*) from u) = 0, 'member cannot update another member');

-- Admin -------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select tests.assert((select count(*) from public.profiles) = 3, 'admin sees all members');
select tests.assert(public.is_admin(), 'admin is admin');

update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000c1';
select tests.assert(
  (select approved_at is not null and approved_by = '00000000-0000-0000-0000-0000000000a1'
   from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'admin approval stamps approved_at / approved_by');
select tests.assert(
  (select count(*) from public.audit_log where action = 'member.status'
     and target_id = '00000000-0000-0000-0000-0000000000c1') = 1,
  'approval is written to the audit log');

do $$ begin
  update public.profiles set status = 'suspended' where id = auth.uid();
  raise exception 'admin suspended themselves';
exception when insufficient_privilege then
  perform tests.assert(true, 'admin cannot suspend themselves');
end $$;

update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000b1';
reset role;

-- Suspended member loses active status
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select tests.assert(not public.is_active_member(), 'suspended member is no longer active');
reset role;

-- Service role -------------------------------------------------------------------
set role service_role;
select public.revoke_member_sessions('00000000-0000-0000-0000-0000000000b1');
insert into public.registration_attempts (ip_hash) values ('abc');
select tests.assert((select count(*) from public.registration_attempts) = 1, 'service role writes registration attempts');
reset role;
select tests.assert((select count(*) from auth.sessions) = 0, 'service role can revoke sessions');
