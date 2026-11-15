-- Phase 2 tests: workouts, sessions, recurring series, duplication, RSVPs.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, member_code, display_name, age, role, status) values
  ('00000000-0000-0000-0000-00000000000a', 'AAAAAA', 'Admin', 40, 'admin', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'BBBBBB', 'Bea', 30, 'member', 'active'),
  ('00000000-0000-0000-0000-00000000000c', 'CCCCCC', 'Cal', 35, 'member', 'active'),
  ('00000000-0000-0000-0000-00000000000d', 'DDDDDD', 'Dee', 28, 'member', 'pending');

-- Admin builds the week -------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

insert into public.workouts (id, title, workout_date, status) values
  ('10000000-0000-0000-0000-000000000001', 'Published WOD', current_date, 'published'),
  ('10000000-0000-0000-0000-000000000002', 'Draft WOD', current_date + 1, 'draft'),
  ('10000000-0000-0000-0000-000000000003', 'Future reveal', current_date + 2, 'published');
update public.workouts set publish_at = now() + interval '2 days' where id = '10000000-0000-0000-0000-000000000003';
insert into public.workout_sections (workout_id, position, kind, title, scoring, level1, level2) values
  ('10000000-0000-0000-0000-000000000001', 0, 'conditioning', 'Engine', 'for_time', '400m row', '500m row'),
  ('10000000-0000-0000-0000-000000000002', 0, 'conditioning', 'Secret', 'amrap', 'x', 'y');

insert into public.class_sessions (id, title, starts_at, capacity, published, workout_id) values
  ('20000000-0000-0000-0000-000000000001', 'CrossFit', now() + interval '2 hours', 2, true, '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Hidden', now() + interval '3 hours', 10, false, null),
  ('20000000-0000-0000-0000-000000000003', 'Yesterday', now() - interval '1 day', 10, true, null);
insert into public.class_sessions (id, title, starts_at, published, status) values
  ('20000000-0000-0000-0000-000000000004', 'Cancelled', now() + interval '1 day', true, 'cancelled');
select tests.assert((select capacity from public.class_sessions where title = 'Cancelled') = 10, 'default capacity is 10');

-- Recurring series
insert into public.session_series (id, title, weekday, start_time, starts_on)
values ('30000000-0000-0000-0000-000000000001', 'Open Gym', 6, '09:00', current_date);
select tests.assert(public.generate_series_sessions('30000000-0000-0000-0000-000000000001', current_date + 27) = 4,
  'series generates 4 weekly sessions over 4 weeks');
select tests.assert(public.generate_series_sessions('30000000-0000-0000-0000-000000000001', current_date + 27) = 0,
  'regenerating a series creates no duplicates');
select tests.assert(
  (select bool_and(extract(isodow from starts_at at time zone public.club_timezone()) = 6
               and (starts_at at time zone public.club_timezone())::time = '09:00')
   from public.class_sessions where series_id = '30000000-0000-0000-0000-000000000001'),
  'series sessions land on Saturday 09:00 gym time');

-- Duplicate week
insert into public.workouts (id, title, workout_date, status) values
  ('10000000-0000-0000-0000-000000000009', 'Monday WOD', date '2026-01-05', 'published');
insert into public.workout_sections (workout_id, title, scoring) values ('10000000-0000-0000-0000-000000000009', 'Main', 'for_time');
insert into public.class_sessions (title, starts_at, published, workout_id) values
  ('Mon 6am', (date '2026-01-05' + time '06:00') at time zone public.club_timezone(), true, '10000000-0000-0000-0000-000000000009'),
  ('Wed 6pm', (date '2026-01-07' + time '18:00') at time zone public.club_timezone(), true, null);
select tests.assert(public.duplicate_week(date '2026-01-05', date '2026-01-12', true) = 2, 'duplicate week copies sessions');
select tests.assert(
  (select count(*) from public.class_sessions
   where (starts_at at time zone public.club_timezone()) in (timestamp '2026-01-12 06:00', timestamp '2026-01-14 18:00')
     and not published) = 2,
  'copied sessions keep local times and start unpublished');
select tests.assert(
  (select w.status = 'draft' and w.workout_date = date '2026-01-12' and (select count(*) from public.workout_sections where workout_id = w.id) = 1
   from public.class_sessions s join public.workouts w on w.id = s.workout_id
   where (s.starts_at at time zone public.club_timezone()) = timestamp '2026-01-12 06:00'),
  'copied workouts are drafts with their sections');
do $$ begin
  perform public.duplicate_week(date '2026-01-06', date '2026-01-13', true);
  raise exception 'non-Monday accepted';
exception when invalid_parameter_value then perform tests.assert(true, 'duplicate week requires Mondays');
end $$;

-- Member visibility -----------------------------------------------------------
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select tests.assert((select count(*) from public.workouts) = 2, 'member sees only published, revealed workouts');
select tests.assert(not exists (select 1 from public.workouts where title in ('Draft WOD', 'Future reveal')), 'drafts and future reveals are hidden');
select tests.assert((select count(*) from public.workout_sections where title = 'Secret') = 0, 'sections of drafts are hidden');
select tests.assert(not exists (select 1 from public.class_sessions where not published), 'member cannot see unpublished sessions');
select tests.assert((select count(*) from public.session_series) = 0, 'member cannot see series');
select tests.assert(
  (select count(*) from public.member_schedule(now() - interval '2 days', now() + interval '2 days')) = 3,
  'member_schedule returns published sessions only');

do $$ begin
  insert into public.workouts (title, workout_date) values ('Hack', current_date);
  raise exception 'member created workout';
exception when insufficient_privilege then perform tests.assert(true, 'member cannot create workouts');
end $$;
do $$ begin
  perform public.duplicate_week(date '2026-01-05', date '2026-01-19', false);
  raise exception 'member duplicated week';
exception when insufficient_privilege then perform tests.assert(true, 'member cannot duplicate weeks');
end $$;

-- RSVPs -------------------------------------------------------------------------
insert into public.reservations (session_id, member_id, status)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'going');
select tests.assert(
  (select going_count from public.member_schedule(now(), now() + interval '1 day') where title = 'CrossFit') = 1
  and (select my_status from public.member_schedule(now(), now() + interval '1 day') where title = 'CrossFit') = 'going',
  'RSVP going counts and shows my status');
update public.reservations set status = 'maybe' where session_id = '20000000-0000-0000-0000-000000000001' and member_id = auth.uid();
update public.reservations set status = 'going' where session_id = '20000000-0000-0000-0000-000000000001' and member_id = auth.uid();
select tests.assert(true, 'member can change RSVP between going / maybe');

do $$ begin
  update public.reservations set attended = true where member_id = auth.uid();
  raise exception 'member marked attendance';
exception when insufficient_privilege then perform tests.assert(true, 'member cannot mark own attendance');
end $$;
do $$ begin
  insert into public.reservations (session_id, member_id, status)
  values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'going');
  raise exception 'member RSVPd for someone else';
exception when insufficient_privilege then perform tests.assert(true, 'member cannot RSVP for someone else');
end $$;
do $$ begin
  insert into public.reservations (session_id, member_id, status) values ('20000000-0000-0000-0000-000000000003', auth.uid(), 'going');
  raise exception 'RSVP to past session';
exception when invalid_parameter_value then perform tests.assert(true, 'cannot RSVP to a past session');
end $$;
do $$ begin
  insert into public.reservations (session_id, member_id, status) values ('20000000-0000-0000-0000-000000000004', auth.uid(), 'going');
  raise exception 'RSVP to cancelled session';
exception when invalid_parameter_value then perform tests.assert(true, 'cannot RSVP to a cancelled session');
end $$;
do $$ begin
  insert into public.reservations (session_id, member_id, status) values ('20000000-0000-0000-0000-000000000002', auth.uid(), 'going');
  raise exception 'RSVP to hidden session';
exception when insufficient_privilege or invalid_parameter_value or no_data_found then
  perform tests.assert(true, 'cannot RSVP to an unpublished session');
end $$;

-- Capacity: session 1 holds 2.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
insert into public.reservations (session_id, member_id, status) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'going');
select tests.assert((select count(*) from public.session_attendees('20000000-0000-0000-0000-000000000001')) = 2,
  'attendee list shows going members');
select tests.assert((select count(*) from public.reservations) = 1, 'members only read their own reservation rows');

reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, member_code, display_name, age, status) values ('00000000-0000-0000-0000-00000000000e', 'EEEEEE', 'Eve', 33, 'active');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e"}';
do $$ begin
  insert into public.reservations (session_id, member_id, status) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'going');
  raise exception 'capacity exceeded';
exception when exclusion_violation then perform tests.assert(true, 'going is blocked for members when the class is full');
end $$;
insert into public.reservations (session_id, member_id, status) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'maybe');
select tests.assert(true, 'maybe is allowed when the class is full');
do $$ begin
  update public.reservations set status = 'going' where member_id = auth.uid();
  raise exception 'upgraded maybe to going past capacity';
exception when exclusion_violation then perform tests.assert(true, 'cannot switch maybe to going when full');
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
update public.reservations set attended = true where member_id = '00000000-0000-0000-0000-00000000000b';
select tests.assert((select count(*) from public.reservations where attended) = 1, 'admin records attendance');

-- Pending member ----------------------------------------------------------------
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select tests.assert((select count(*) from public.workouts) = 0, 'pending member sees no workouts');
select tests.assert((select count(*) from public.class_sessions) = 0, 'pending member sees no sessions');
select tests.assert((select count(*) from public.member_schedule(now() - interval '9 days', now() + interval '9 days')) = 0,
  'pending member gets an empty schedule');
select tests.assert((select count(*) from public.session_attendees('20000000-0000-0000-0000-000000000001')) = 0,
  'pending member cannot see attendees');
do $$ begin
  insert into public.reservations (session_id, member_id, status) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'maybe');
  raise exception 'pending member RSVPd';
exception when insufficient_privilege then perform tests.assert(true, 'pending member cannot RSVP');
end $$;
reset role;
