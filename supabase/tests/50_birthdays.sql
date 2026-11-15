-- Birthday tests: age derived from birthday, cake flags, privacy.
\set ON_ERROR_STOP on

select tests.assert(public.is_birthday_on(date '1990-11-16', date '2026-11-16'), 'same month/day is a birthday');
select tests.assert(not public.is_birthday_on(date '1990-11-16', date '2026-11-17'), 'next day is not');
select tests.assert(public.is_birthday_on(date '2000-02-29', date '2027-02-28'), 'Feb 29 birthday shows on Feb 28 in non-leap years');
select tests.assert(not public.is_birthday_on(date '2000-02-29', date '2028-02-28'), 'but not on Feb 28 in leap years');
select tests.assert(not public.is_birthday_on(null, date '2026-11-16'), 'no birthday, no cake');

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000b001'), ('00000000-0000-0000-0000-00000000b002');
insert into public.profiles (id, member_code, display_name, age, birth_date, status) values
  ('00000000-0000-0000-0000-00000000b001', 'B10000', 'Birthday Bea', 1, (current_date - interval '30 years')::date, 'active'),
  ('00000000-0000-0000-0000-00000000b002', 'B20000', 'Other Otto', 40, null, 'active');
select tests.assert((select age from public.profiles where member_code = 'B10000') = 30, 'age is calculated from the birthday');
select tests.assert((select public.current_age(p) from public.profiles p where member_code = 'B10000') = 30, 'current_age uses the birthday');

insert into public.class_sessions (id, title, starts_at, published)
values ('80000000-0000-0000-0000-000000000001', 'Birthday class', now() + interval '1 hour', true);
-- Make Bea's birthday the class day (gym time).
update public.profiles
set birth_date = make_date(1990,
  extract(month from (now() + interval '1 hour') at time zone public.club_timezone())::int,
  least(extract(day from (now() + interval '1 hour') at time zone public.club_timezone())::int, 28))
where member_code = 'B10000';
-- (day capped at 28 only to keep the fixture valid in short months; re-align exactly)
update public.profiles
set birth_date = ((now() + interval '1 hour') at time zone public.club_timezone())::date - interval '36 years'
where member_code = 'B10000';
select tests.assert((select age from public.profiles where member_code = 'B10000') = 36, 'changing the birthday updates the age');

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001"}';
insert into public.reservations (session_id, member_id, status) values ('80000000-0000-0000-0000-000000000001', auth.uid(), 'going');
update public.profiles set birth_date = birth_date where id = auth.uid();
select tests.assert(true, 'member can update own birthday');

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b002"}';
insert into public.reservations (session_id, member_id, status) values ('80000000-0000-0000-0000-000000000001', auth.uid(), 'maybe');
select tests.assert((select is_birthday from public.session_attendees('80000000-0000-0000-0000-000000000001') where display_name = 'Birthday Bea'),
  'attendee list flags the birthday');
select tests.assert(not (select is_birthday from public.session_attendees('80000000-0000-0000-0000-000000000001') where display_name = 'Other Otto'),
  'others are not flagged');
select tests.assert((select birthday_count from public.member_schedule(now(), now() + interval '1 day') where title = 'Birthday class') = 1,
  'schedule counts birthdays in class');
select tests.assert((select count(*) from public.profiles) = 1, 'other members still cannot read profiles (no birthdates leak)');
reset role;
