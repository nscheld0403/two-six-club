-- Hardening tests: anonymous callers can't reach helper or trigger functions,
-- and triggers still fire for signed-in users after EXECUTE was revoked.
\set ON_ERROR_STOP on

select tests.assert(not has_function_privilege('anon', 'public.is_admin()', 'execute'), 'anon cannot call is_admin');
select tests.assert(not has_function_privilege('anon', 'public.is_active_member()', 'execute'), 'anon cannot call is_active_member');
select tests.assert(not has_function_privilege('anon', 'public.club_timezone()', 'execute'), 'anon cannot call club_timezone');
select tests.assert(not has_function_privilege('authenticated', 'public.profiles_after_update()', 'execute'), 'trigger functions are not callable');
select tests.assert(has_function_privilege('authenticated', 'public.is_admin()', 'execute'), 'members can still evaluate RLS helpers');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1');
insert into public.profiles (id, member_code, display_name, age, status) values ('00000000-0000-0000-0000-0000000000f1', 'F00000', 'Fay', 30, 'active');
insert into public.class_sessions (id, title, starts_at, published) values ('70000000-0000-0000-0000-000000000001', 'Hardening class', now() + interval '1 day', true);

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1"}';
update public.profiles set display_name = 'Fay R' where id = auth.uid();
insert into public.reservations (session_id, member_id, status) values ('70000000-0000-0000-0000-000000000001', auth.uid(), 'going');
insert into public.results (performed_on, title, scoring, reps) values (current_date, 'Max push-ups', 'max_reps', 40);
select tests.assert((select score_value from public.results where title = 'Max push-ups') = 40, 'triggers still fire after EXECUTE revoke');
do $$ begin
  update public.profiles set status = 'suspended' where id = auth.uid();
  raise exception 'guard trigger did not run';
exception when insufficient_privilege then perform tests.assert(true, 'profile guard trigger still enforced');
end $$;
reset role;
