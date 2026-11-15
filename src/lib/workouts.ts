import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SectionRow, WorkoutRow } from "@/lib/supabase/database.types";

export type WorkoutWithSections = WorkoutRow & { sections: SectionRow[] };

/** Loads workouts (RLS decides visibility) with their sections in order. */
export async function loadWorkouts(filter: { ids?: string[]; dates?: string[]; from?: string; to?: string }) {
  const supabase = await createClient();
  let q = supabase.from("workouts").select("*").eq("is_template", false);
  if (filter.ids) q = q.in("id", filter.ids);
  if (filter.dates) q = q.in("workout_date", filter.dates);
  if (filter.from) q = q.gte("workout_date", filter.from);
  if (filter.to) q = q.lte("workout_date", filter.to);
  const { data: workouts } = await q.order("workout_date", { ascending: false });
  if (!workouts?.length) return [] as WorkoutWithSections[];
  const { data: sections } = await supabase
    .from("workout_sections")
    .select("*")
    .in(
      "workout_id",
      workouts.map((w) => w.id),
    )
    .order("position");
  return workouts.map((w) => ({ ...w, sections: (sections ?? []).filter((s) => s.workout_id === w.id) }));
}

export function sectionLetter(i: number) {
  return String.fromCharCode(65 + i);
}

export function formatCap(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")} cap`;
}
