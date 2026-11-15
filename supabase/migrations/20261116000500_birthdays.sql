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
