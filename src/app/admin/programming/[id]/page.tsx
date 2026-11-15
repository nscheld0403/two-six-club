import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { isDateKey, todayKey } from "@/lib/time";
import { WorkoutEditor, type EditorWorkout } from "../workout-editor";

export const metadata = { title: "Edit workout" };

/** /admin/programming/new (?date=&from=&template=1) or /admin/programming/<id>. */
export default async function EditWorkoutPage({ params, searchParams }: PageProps<"/admin/programming/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { timeZone } = await getClubSettings();
  const { data: movements } = await supabase.from("movements").select("id, name").order("name");

  const isNew = id === "new";
  const sourceId = isNew ? (typeof sp.from === "string" ? sp.from : null) : id;
  if (sourceId && !/^[0-9a-f-]{36}$/i.test(sourceId)) notFound();

  let initial: EditorWorkout;
  if (sourceId) {
    const { data: w } = await supabase.from("workouts").select("*").eq("id", sourceId).maybeSingle();
    if (!w) notFound();
    const { data: sections } = await supabase.from("workout_sections").select("*").eq("workout_id", w.id).order("position");
    const copy = isNew; // "Use template": a fresh workout from the template
    initial = {
      id: copy ? null : w.id,
      title: w.title,
      workoutDate: copy ? (typeof sp.date === "string" && isDateKey(sp.date) ? sp.date : todayKey(timeZone)) : w.workout_date,
      discipline: w.discipline,
      summary: w.summary ?? "",
      coachNotes: w.coach_notes ?? "",
      status: copy ? "draft" : w.status,
      publishAt: copy ? null : w.publish_at,
      isTemplate: copy ? false : w.is_template,
      sections: (sections ?? []).map((s) => ({
        id: copy ? null : s.id,
        kind: s.kind,
        title: s.title,
        scoring: s.scoring,
        movementId: s.movement_id,
        benchmarkName: s.benchmark_name ?? "",
        timeCapSeconds: s.time_cap_seconds,
        roundsTarget: s.rounds_target,
        distanceM: s.distance_m != null ? Number(s.distance_m) : null,
        level1: s.level1 ?? "",
        level2: s.level2 ?? "",
        notes: s.notes ?? "",
      })),
    };
  } else {
    const template = sp.template === "1";
    initial = {
      id: null,
      title: "",
      workoutDate: template ? null : typeof sp.date === "string" && isDateKey(sp.date) ? sp.date : todayKey(timeZone),
      discipline: "crossfit",
      summary: "",
      coachNotes: "",
      status: "draft",
      publishAt: null,
      isTemplate: template,
      sections: [
        { id: null, kind: "warmup", title: "Warm-up", scoring: "none", movementId: null, benchmarkName: "", timeCapSeconds: null, roundsTarget: null, distanceM: null, level1: "", level2: "", notes: "" },
        { id: null, kind: "conditioning", title: "Conditioning", scoring: "for_time", movementId: null, benchmarkName: "", timeCapSeconds: null, roundsTarget: null, distanceM: null, level1: "", level2: "", notes: "" },
      ],
    };
  }

  return <WorkoutEditor initial={initial} movements={movements ?? []} timeZone={timeZone} />;
}
