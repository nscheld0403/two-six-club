import { notFound } from "next/navigation";
import { requireActiveMember } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/time";
import { LogForm } from "../log-form";

export const metadata = { title: "Log result" };

export default async function LogSectionPage({ params, searchParams }: PageProps<"/log/[sectionId]">) {
  const me = await requireActiveMember();
  const { sectionId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(sectionId)) notFound();

  const supabase = await createClient();
  const { data: section } = await supabase.from("workout_sections").select("*").eq("id", sectionId).maybeSingle();
  if (!section || section.scoring === "none") notFound();
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", section.workout_id).maybeSingle();
  if (!workout) notFound();

  const [{ data: existing }, { data: movements }] = await Promise.all([
    supabase.from("results").select("*").eq("member_id", me.id).eq("section_id", section.id).maybeSingle(),
    supabase.from("movements").select("id, name").order("name"),
  ]);
  const { data: sets } = existing
    ? await supabase.from("result_sets").select("*").eq("result_id", existing.id).order("set_no")
    : { data: [] };
  const { timeZone } = await getClubSettings();

  const hasLevels = Boolean(section.level1 && section.level2);
  const requestedLevel = sp.level === "1" ? 1 : sp.level === "2" ? 2 : null;
  const sectionTitle = section.title === workout.title ? workout.title : `${workout.title}: ${section.title}`;

  return (
    <LogForm
      movements={movements ?? []}
      initial={{
        resultId: existing?.id ?? null,
        sectionId: section.id,
        title: sectionTitle,
        subtitle: `${section.title} · ${workout.workout_date ?? ""}`,
        scoring: section.scoring,
        movementId: section.movement_id,
        benchmarkName: section.benchmark_name,
        hasLevels,
        level: ((existing?.level as 1 | 2 | null) ?? requestedLevel ?? 2) as 1 | 2,
        rx: existing?.rx ?? true,
        performedOn: existing?.performed_on ?? workout.workout_date ?? todayKey(timeZone),
        timeCapSeconds: section.time_cap_seconds,
        timeSeconds: existing?.time_seconds ?? null,
        capped: existing?.capped ?? false,
        rounds: existing?.rounds ?? null,
        reps: existing?.reps ?? null,
        distanceM: existing?.distance_m ?? section.distance_m ?? null,
        calories: existing?.calories ?? null,
        rpe: existing?.rpe ?? null,
        notes: existing?.notes ?? "",
        sets: (sets ?? []).map((s) => ({ reps: s.reps, load: Number(s.load_lbs) })),
        freeForm: false,
        backHref: `/workouts/${workout.id}`,
      }}
    />
  );
}
