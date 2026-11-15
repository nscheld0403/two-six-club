-- Phase 3-4 tests: results scoring, privacy, PR views, leaderboards.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000aa'), ('00000000-0000-0000-0000-0000000000bb'),
  ('00000000-0000-0000-0000-0000000000cc'), ('00000000-0000-0000-0000-0000000000dd');
insert into public.profiles (id, member_code, display_name, age, sex, role, status, results_visible, show_demographics) values
  ('00000000-0000-0000-0000-0000000000aa', 'A00000', 'Coach', 40, 'male', 'admin', 'active', true, false),
  ('00000000-0000-0000-0000-0000000000bb', 'B00000', 'Bea', 31, 'female', 'member', 'active', true, true),
  ('00000000-0000-0000-0000-0000000000cc', 'C00000', 'Private Cal', 35, 'male', 'member', 'active', false, true),
  ('00000000-0000-0000-0000-0000000000dd', 'D00000', 'Dana', 45, 'female', 'member', 'active', true, false);

insert into public.workouts (id, title, workout_date, status) values
  ('40000000-0000-0000-0000-000000000001', 'Engine Room', current_date, 'published');
insert into public.workout_sections (id, workout_id, title, scoring, benchmark_name, movement_id) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Engine Room', 'for_time', 'Engine Room', null),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Back Squat', 'sets_reps', null,
   (select id from public.movements where name = 'Back Squat'));

set role authenticated;

-- Bea: finished in 13:42, Rx, level 2; strength sets
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000bb"}';
insert into public.results (id, section_id, performed_on, title, scoring, benchmark_name, level, rx, time_seconds)
values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', current_date, 'Engine Room', 'for_time', 'Engine Room', 2, true, 822);
select tests.assert((select score_value from public.results where id = '60000000-0000-0000-0000-000000000001') = 10000000 - 822,
  'for-time score normalises to higher-is-better');
do $$ begin
  insert into public.results (section_id, performed_on, title, scoring, level, rx, time_seconds)
  values ('50000000-0000-0000-0000-000000000001', current_date, 'Engine Room', 'for_time', 2, true, 700);
  raise exception 'duplicate result for the same section';
exception when unique_violation then perform tests.assert(true, 'one result per member per section');
end $$;
do $$ begin
  insert into public.results (performed_on, title, scoring) values (current_date, 'Bad', 'for_time');
  raise exception 'missing time accepted';
exception when check_violation then perform tests.assert(true, 'for-time result requires a time');
end $$;

insert into public.results (id, section_id, performed_on, title, scoring, movement_id, load_lbs)
values ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', current_date, 'Back Squat', 'sets_reps',
        (select id from public.movements where name = 'Back Squat'), 205);
insert into public.result_sets (result_id, set_no, reps, load_lbs) values
  ('60000000-0000-0000-0000-000000000002', 1, 3, 185), ('60000000-0000-0000-0000-000000000002', 2, 3, 195),
  ('60000000-0000-0000-0000-000000000002', 3, 3, 205);
-- an older heavy single
insert into public.results (id, performed_on, title, scoring, movement_id, load_lbs)
values ('60000000-0000-0000-0000-000000000003', current_date - 30, 'Back Squat', 'max_weight',
        (select id from public.movements where name = 'Back Squat'), 225);
insert into public.result_sets values ('60000000-0000-0000-0000-000000000003', 1, 1, 225);

select tests.assert((select load_lbs from public.lift_bests where reps = 3) = 205, 'lift_bests: best 3-rep load');
select tests.assert((select load_lbs from public.lift_bests where reps = 1) = 225, 'lift_bests: best single');
select tests.assert((select e1rm_lbs from public.e1rm_daily where performed_on = current_date) = 225.5,
  'e1rm uses Epley on the best set (205 x 3 = 225.5)');
select tests.assert((select volume_lbs from public.e1rm_daily where performed_on = current_date) = 1755,
  'daily volume sums reps x load');
select tests.assert((select score_value from public.benchmark_bests where benchmark_name = 'Engine Room') = 10000000 - 822,
  'benchmark_bests returns the best benchmark score');

-- Cal: private, capped with 120 reps
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000cc"}';
insert into public.results (section_id, performed_on, title, scoring, benchmark_name, level, rx, capped, reps)
values ('50000000-0000-0000-0000-000000000001', current_date, 'Engine Room', 'for_time', 'Engine Room', 2, true, true, 120);
select tests.assert((select count(*) from public.results) = 1, 'members read only their own results');
select tests.assert((select count(*) from public.lift_bests) = 0, 'analytics views only show own data');
select tests.assert((select count(*) from public.section_leaderboard('50000000-0000-0000-0000-000000000001')) = 2,
  'private member still sees themselves on the leaderboard');

-- Dana: level 1, scaled, faster time
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000dd"}';
insert into public.results (id, section_id, performed_on, title, scoring, benchmark_name, level, rx, time_seconds)
values ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', current_date, 'Engine Room', 'for_time', 'Engine Room', 1, false, 700);

-- Leaderboard as Bea: Cal hidden, Rx ranks above scaled, demographics only if opted in.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000bb"}';
select tests.assert((select count(*) from public.section_leaderboard('50000000-0000-0000-0000-000000000001')) = 2,
  'hidden results are excluded for other members');
select tests.assert(not exists (select 1 from public.section_leaderboard('50000000-0000-0000-0000-000000000001') where display_name = 'Private Cal'),
  'private member is not listed');
select tests.assert((select display_name from public.section_leaderboard('50000000-0000-0000-0000-000000000001') limit 1) = 'Bea',
  'Rx result ranks above a faster scaled result');
select tests.assert((select sex is null and age_group is null from public.section_leaderboard('50000000-0000-0000-0000-000000000001') where display_name = 'Dana'),
  'no demographics for members who did not opt in');
select tests.assert((select sex = 'female' and age_group = '30–39' from public.section_leaderboard('50000000-0000-0000-0000-000000000001') where is_me),
  'opted-in member has sex and age group');
select tests.assert((select count(*) from public.benchmark_leaderboard('engine room')) = 2, 'benchmark board is case-insensitive and respects privacy');
select tests.assert(exists (select 1 from public.benchmark_names() where benchmark_name = 'Engine Room'), 'benchmark names are listed');

do $$ begin
  update public.results set notes = 'hacked' where member_id = '00000000-0000-0000-0000-0000000000dd';
  perform tests.assert((select count(*) from public.results where notes = 'hacked') = 0, 'member cannot edit another member''s result');
end $$;
do $$ begin
  insert into public.result_sets values ('60000000-0000-0000-0000-000000000004', 9, 1, 1);
  raise exception 'wrote sets on someone else''s result';
exception when insufficient_privilege then perform tests.assert(true, 'member cannot add sets to another member''s result');
end $$;

-- Admin sees everyone, including private results.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000aa"}';
select tests.assert((select count(*) from public.section_leaderboard('50000000-0000-0000-0000-000000000001')) = 3,
  'admin sees private results on the leaderboard');

-- Suspended member's results disappear from boards.
reset role;
update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000dd';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000bb"}';
select tests.assert((select count(*) from public.section_leaderboard('50000000-0000-0000-0000-000000000001')) = 1,
  'suspended members drop off the leaderboard');
reset role;
