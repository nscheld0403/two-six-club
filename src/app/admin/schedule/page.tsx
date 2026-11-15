import { requireAdmin } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { addDays, dateKeyIn, isDateKey, localTimeOf, mondayOf, todayKey, zonedToUtc } from "@/lib/time";
import { ScheduleManager } from "./schedule-manager";

export const metadata = { title: "Class schedule" };

export default async function AdminSchedulePage({ searchParams }: PageProps<"/admin/schedule">) {
  await requireAdmin();
  const sp = await searchParams;
  const { timeZone, defaultCapacity } = await getClubSettings();
  const today = todayKey(timeZone);
  const monday = mondayOf(typeof sp.week === "string" && isDateKey(sp.week) ? sp.week : today);
  const supabase = await createClient();

  const [{ data: sessions }, { data: workouts }, { data: series }] = await Promise.all([
    supabase
      .from("class_sessions")
      .select("*")
      .gte("starts_at", zonedToUtc(monday, "00:00", timeZone).toISOString())
      .lt("starts_at", zonedToUtc(addDays(monday, 7), "00:00", timeZone).toISOString())
      .order("starts_at"),
    supabase.from("workouts").select("id, title, workout_date, status").eq("is_template", false).gte("workout_date", monday).lte("workout_date", addDays(monday, 6)),
    supabase.from("session_series").select("*").eq("active", true).order("weekday").order("start_time"),
  ]);

  const ids = (sessions ?? []).map((s) => s.id);
  const { data: rsvps } = ids.length ? await supabase.from("reservations").select("session_id, status").in("session_id", ids) : { data: [] };

  return (
    <ScheduleManager
      key={monday}
      monday={monday}
      today={today}
      timeZone={timeZone}
      defaultCapacity={defaultCapacity}
      sessions={(sessions ?? []).map((s) => ({
        ...s,
        date: dateKeyIn(new Date(s.starts_at), timeZone),
        time: localTimeOf(s.starts_at, timeZone),
        going: (rsvps ?? []).filter((r) => r.session_id === s.id && r.status === "going").length,
        maybe: (rsvps ?? []).filter((r) => r.session_id === s.id && r.status === "maybe").length,
      }))}
      workouts={workouts ?? []}
      series={series ?? []}
    />
  );
}
