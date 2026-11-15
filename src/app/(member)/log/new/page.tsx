import { notFound } from "next/navigation";
import { requireActiveMember } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/time";
import { LogForm } from "../log-form";

export const metadata = { title: "Log a workout" };

/** Free-form log: lifts, benchmarks or anything done outside a programmed class. */
export default async function LogNewPage({ searchParams }: PageProps<"/log/new">) {
  const me = await requireActiveMember();
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" && /^[0-9a-f-]{36}$/i.test(sp.edit) ? sp.edit : null;
  const supabase = await createClient();
  const { timeZone } = await getClubSettings();
  const { data: movements } = await supabase.from("movements").select("id, name").order("name");

  const existing = editId
    ? (await supabase.from("results").select("*").eq("id", editId).eq("member_id", me.id).maybeSingle()).data
    : null;
  if (editId && !existing) notFound();
  const { data: sets } = existing
    ? await supabase.from("result_sets").select("*").eq("result_id", existing.id).order("set_no")
    : { data: [] };

  return (
    <LogForm
      movements={movements ?? []}
      initial={{
        resultId: existing?.id ?? null,
        sectionId: null,
        title: existing?.title ?? "",
        subtitle: existing ? "Edit your log" : "Outside of class, or something extra",
        scoring: existing?.scoring ?? "sets_reps",
        movementId: existing?.movement_id ?? null,
        benchmarkName: existing?.benchmark_name ?? null,
        hasLevels: false,
        level: ((existing?.level as 1 | 2 | null) ?? 2) as 1 | 2,
        rx: existing?.rx ?? true,
        performedOn: existing?.performed_on ?? todayKey(timeZone),
        timeCapSeconds: null,
        timeSeconds: existing?.time_seconds ?? null,
        capped: existing?.capped ?? false,
        rounds: existing?.rounds ?? null,
        reps: existing?.reps ?? null,
        distanceM: existing?.distance_m ?? null,
        calories: existing?.calories ?? null,
        rpe: existing?.rpe ?? null,
        notes: existing?.notes ?? "",
        sets: (sets ?? []).map((s) => ({ reps: s.reps, load: Number(s.load_lbs) })),
        freeForm: true,
        backHref: "/log",
      }}
    />
  );
}
