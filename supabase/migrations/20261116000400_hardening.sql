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
