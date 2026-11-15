import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { addDays, dateKeyIn, isDateKey, mondayOf, todayKey, zonedToUtc } from "@/lib/time";
import { requireActiveMember } from "@/lib/auth";
import { ScheduleView } from "./schedule-view";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  await requireActiveMember();
  const { timeZone } = await getClubSettings();
  const sp = await searchParams;
  const today = todayKey(timeZone);
  const requested = typeof sp.week === "string" && isDateKey(sp.week) ? sp.week : today;
  const monday = mondayOf(requested);
  const selected = typeof sp.day === "string" && isDateKey(sp.day) && mondayOf(sp.day) === monday ? sp.day : monday === mondayOf(today) ? today : monday;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_schedule", {
    p_from: zonedToUtc(monday, "00:00", timeZone).toISOString(),
    p_to: zonedToUtc(addDays(monday, 7), "00:00", timeZone).toISOString(),
  });
  if (error) console.error("member_schedule failed", error);

  const sessions = (data ?? []).map((s) => ({ ...s, day: dateKeyIn(new Date(s.starts_at), timeZone) }));

  return (
    <ScheduleView
      key={monday}
      monday={monday}
      today={today}
      initialDay={selected}
      timeZone={timeZone}
      sessions={sessions}
      nowIso={new Date().toISOString()}
    />
  );
}
