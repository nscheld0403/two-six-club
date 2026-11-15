"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { addDays, isoWeekday, mondayOf, todayKey, zonedToUtc } from "@/lib/time";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const sessionInput = z.object({
  id: z.uuid().nullable().optional(),
  title: z.string().trim().min(1, "Give the session a name").max(60),
  kind: z.enum(["class", "open_gym"]),
  discipline: z.enum(["crossfit", "hyrox", "strength", "conditioning", "mobility", "open_gym"]),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
  durationMin: z.number().int().min(10).max(300),
  capacity: z.number().int().min(1).max(200),
  coachLabel: z.string().trim().max(40).nullable().optional(),
  workoutId: z.uuid().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  published: z.boolean(),
  repeatWeekly: z.boolean().optional(),
  repeatUntil: z.iso.date().nullable().optional(),
});
export type SessionInput = z.input<typeof sessionInput>;

function done(message?: string): ActionResult {
  revalidatePath("/admin/schedule");
  revalidatePath("/schedule");
  revalidatePath("/");
  return { ok: true, message };
}

export async function saveSession(raw: SessionInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = sessionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the session" };
  const s = parsed.data;
  const { timeZone } = await getClubSettings();
  const supabase = await createClient();
  const startsAt = zonedToUtc(s.date, s.time, timeZone).toISOString();
  const common = {
    title: s.title,
    kind: s.kind,
    discipline: s.kind === "open_gym" ? ("open_gym" as const) : s.discipline,
    duration_min: s.durationMin,
    capacity: s.capacity,
    coach_label: s.coachLabel || null,
  };

  if (!s.id && s.repeatWeekly) {
    const until = s.repeatUntil ?? addDays(s.date, 7 * 11);
    const { data: series, error } = await supabase
      .from("session_series")
      .insert({ ...common, weekday: isoWeekday(s.date), start_time: s.time, starts_on: s.date, ends_on: s.repeatUntil ?? null })
      .select("id")
      .single();
    if (error || !series) return { ok: false, message: error?.message ?? "Couldn't create the series" };
    const { data: n, error: genError } = await supabase.rpc("generate_series_sessions", { p_series: series.id, p_until: until });
    if (genError) return { ok: false, message: genError.message };
    return done(`Created ${n} weekly sessions through ${until}.`);
  }

  const row = { ...common, starts_at: startsAt, workout_id: s.workoutId ?? null, notes: s.notes || null, published: s.published };
  const { error } = s.id
    ? await supabase.from("class_sessions").update(row).eq("id", s.id)
    : await supabase.from("class_sessions").insert(row);
  if (error) return { ok: false, message: error.message };
  return done(s.id ? "Session updated." : "Session added.");
}

export async function setSessionStatus(id: string, status: "scheduled" | "cancelled"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("class_sessions").update({ status }).eq("id", z.uuid().parse(id));
  if (error) return { ok: false, message: error.message };
  return done(status === "cancelled" ? "Session cancelled. Members see it as cancelled." : "Session restored.");
}

export async function deleteSession(id: string): Promise<ActionResult> {
  await requireAdmin();
  const sid = z.uuid().parse(id);
  const supabase = await createClient();
  const { count } = await supabase.from("reservations").select("member_id", { count: "exact", head: true }).eq("session_id", sid).neq("status", "not_going");
  if ((count ?? 0) > 0) return { ok: false, message: "Members have RSVP'd. Cancel the session instead so they're told." };
  const { error } = await supabase.from("class_sessions").delete().eq("id", sid);
  if (error) return { ok: false, message: error.message };
  return done("Session deleted.");
}

export async function publishWeek(monday: string): Promise<ActionResult> {
  await requireAdmin();
  const m = mondayOf(z.iso.date().parse(monday));
  const { timeZone } = await getClubSettings();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .update({ published: true })
    .gte("starts_at", zonedToUtc(m, "00:00", timeZone).toISOString())
    .lt("starts_at", zonedToUtc(addDays(m, 7), "00:00", timeZone).toISOString())
    .eq("published", false)
    .select("id");
  if (error) return { ok: false, message: error.message };
  return done(`Published ${data?.length ?? 0} sessions.`);
}

export async function duplicateWeek(fromMonday: string, toMonday: string, includeWorkouts: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_week", {
    p_from: mondayOf(z.iso.date().parse(fromMonday)),
    p_to: mondayOf(z.iso.date().parse(toMonday)),
    p_include_workouts: includeWorkouts,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/programming");
  return done(`Copied ${data ?? 0} sessions as unpublished drafts${includeWorkouts ? " (workouts copied as drafts too)" : ""}. Review, then publish the week.`);
}

export async function extendSeries(id: string, weeks = 8): Promise<ActionResult> {
  await requireAdmin();
  const { timeZone } = await getClubSettings();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_series_sessions", {
    p_series: z.uuid().parse(id),
    p_until: addDays(todayKey(timeZone), weeks * 7),
  });
  if (error) return { ok: false, message: error.message };
  return done(`Added ${data ?? 0} sessions.`);
}

export async function stopSeries(id: string): Promise<ActionResult> {
  await requireAdmin();
  const sid = z.uuid().parse(id);
  const { timeZone } = await getClubSettings();
  const supabase = await createClient();
  const today = todayKey(timeZone);
  await supabase.from("session_series").update({ active: false, ends_on: today }).eq("id", sid);
  // Remove future occurrences nobody has RSVP'd to; keep the rest (cancel those manually).
  const { data: future } = await supabase.from("class_sessions").select("id").eq("series_id", sid).gt("starts_at", new Date().toISOString());
  const ids = (future ?? []).map((f) => f.id);
  if (ids.length) {
    const { data: booked } = await supabase.from("reservations").select("session_id").in("session_id", ids);
    const keep = new Set((booked ?? []).map((b) => b.session_id));
    const drop = ids.filter((x) => !keep.has(x));
    if (drop.length) await supabase.from("class_sessions").delete().in("id", drop);
    return done(keep.size ? `Stopped. ${keep.size} future session(s) with RSVPs were kept. Cancel them if needed.` : "Stopped repeating.");
  }
  return done("Stopped repeating.");
}

export async function saveSettings(input: { timezone: string; defaultCapacity: number }): Promise<ActionResult> {
  await requireAdmin();
  const tz = z.string().min(1).max(60).parse(input.timezone);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return { ok: false, message: "That isn't a valid time zone." };
  }
  const cap = z.number().int().min(1).max(200).parse(input.defaultCapacity);
  const supabase = await createClient();
  const { error } = await supabase.from("club_settings").update({ timezone: tz, default_capacity: cap, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

// ----------------------------------------------------------------- roster ---
export async function setAttendance(sessionId: string, memberId: string, attended: boolean | null): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const sid = z.uuid().parse(sessionId);
  const mid = z.uuid().parse(memberId);
  const { data: existing } = await supabase.from("reservations").select("status").eq("session_id", sid).eq("member_id", mid).maybeSingle();
  const { error } = existing
    ? await supabase.from("reservations").update({ attended }).eq("session_id", sid).eq("member_id", mid)
    : await supabase.from("reservations").insert({ session_id: sid, member_id: mid, status: "going", attended });
  if (error) return { ok: false, message: error.code === "23P01" ? "The class is full. Raise the capacity first." : error.message };
  revalidatePath(`/admin/schedule/${sid}`);
  return { ok: true };
}

export async function removeReservation(sessionId: string, memberId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reservations").delete().eq("session_id", z.uuid().parse(sessionId)).eq("member_id", z.uuid().parse(memberId));
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/schedule/${sessionId}`);
  return { ok: true };
}
