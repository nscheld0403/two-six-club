"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const section = z.object({
  id: z.uuid().nullable().optional(),
  kind: z.enum(["warmup", "strength", "conditioning", "skill", "accessory", "cooldown"]),
  title: z.string().trim().min(1, "Every section needs a title").max(80),
  scoring: z.enum(["none", "for_time", "amrap", "emom", "max_weight", "max_reps", "distance", "time_trial", "calories", "sets_reps"]),
  movementId: z.uuid().nullable().optional(),
  benchmarkName: z.string().trim().max(60).nullable().optional(),
  timeCapSeconds: z.number().int().positive().max(86400).nullable().optional(),
  roundsTarget: z.number().int().positive().max(999).nullable().optional(),
  distanceM: z.number().positive().max(1_000_000).nullable().optional(),
  level1: z.string().max(2000).nullable().optional(),
  level2: z.string().max(2000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const workout = z
  .object({
    id: z.uuid().nullable().optional(),
    title: z.string().trim().min(1, "Give the workout a name").max(80),
    workoutDate: z.iso.date().nullable().optional(),
    discipline: z.enum(["crossfit", "hyrox", "strength", "conditioning", "mobility", "open_gym"]),
    summary: z.string().trim().max(500).nullable().optional(),
    coachNotes: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(["draft", "published"]),
    publishAt: z.iso.datetime({ offset: true }).nullable().optional(),
    isTemplate: z.boolean(),
    sections: z.array(section).max(12),
  })
  .refine((w) => w.isTemplate || w.workoutDate, { message: "Choose a date" })
  .refine((w) => w.sections.every((s) => !["sets_reps", "max_weight"].includes(s.scoring) || s.movementId), {
    message: "Strength sections need a movement so PRs can be tracked",
  });

export type WorkoutPayload = z.input<typeof workout>;
export type SaveWorkoutResult = { ok: true; id: string } | { ok: false; message: string };

export async function saveWorkout(raw: WorkoutPayload): Promise<SaveWorkoutResult> {
  const me = await requireAdmin();
  const parsed = workout.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the workout" };
  const w = parsed.data;
  const supabase = await createClient();

  const row = {
    title: w.title,
    workout_date: w.isTemplate ? null : w.workoutDate!,
    discipline: w.discipline,
    summary: w.summary || null,
    coach_notes: w.coachNotes || null,
    status: w.isTemplate ? ("draft" as const) : w.status,
    publish_at: w.publishAt ?? null,
    is_template: w.isTemplate,
  };

  let id = w.id ?? null;
  if (id) {
    const { error } = await supabase.from("workouts").update(row).eq("id", id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { data, error } = await supabase.from("workouts").insert({ ...row, created_by: me.id }).select("id").single();
    if (error || !data) return { ok: false, message: error?.message ?? "Couldn't save" };
    id = data.id;
  }

  // Update sections in place so results already logged against them survive edits.
  const { data: existing } = await supabase.from("workout_sections").select("id").eq("workout_id", id);
  const keep = new Set(w.sections.map((s) => s.id).filter(Boolean) as string[]);
  const removed = (existing ?? []).map((s) => s.id).filter((sid) => !keep.has(sid));
  if (removed.length) {
    const { count } = await supabase.from("results").select("id", { count: "exact", head: true }).in("section_id", removed);
    if ((count ?? 0) > 0) {
      return { ok: false, message: "A section you removed already has member results. Keep it, or clear its text instead." };
    }
    await supabase.from("workout_sections").delete().in("id", removed);
  }
  for (const [position, s] of w.sections.entries()) {
    const data = {
      workout_id: id,
      position,
      kind: s.kind,
      title: s.title,
      scoring: s.scoring,
      movement_id: ["sets_reps", "max_weight"].includes(s.scoring) ? (s.movementId ?? null) : null,
      benchmark_name: s.scoring === "none" ? null : s.benchmarkName || null,
      time_cap_seconds: s.timeCapSeconds ?? null,
      rounds_target: s.roundsTarget ?? null,
      distance_m: s.distanceM ?? null,
      level1: s.level1?.trim() || null,
      level2: s.level2?.trim() || null,
      notes: s.notes?.trim() || null,
    };
    const { error } = s.id && existing?.some((e) => e.id === s.id)
      ? await supabase.from("workout_sections").update(data).eq("id", s.id)
      : await supabase.from("workout_sections").insert(data);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/admin/programming");
  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function deleteWorkout(id: string): Promise<SaveWorkoutResult> {
  await requireAdmin();
  const wid = z.uuid().parse(id);
  const supabase = await createClient();
  const { data: sections } = await supabase.from("workout_sections").select("id").eq("workout_id", wid);
  const ids = (sections ?? []).map((s) => s.id);
  if (ids.length) {
    const { count } = await supabase.from("results").select("id", { count: "exact", head: true }).in("section_id", ids);
    if ((count ?? 0) > 0) return { ok: false, message: "Members have logged results for this workout. Unpublish it instead of deleting." };
  }
  const { error } = await supabase.from("workouts").delete().eq("id", wid);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/programming");
  return { ok: true, id: wid };
}
