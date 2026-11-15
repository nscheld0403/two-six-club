import { requireActiveMember } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateKey, todayKey } from "@/lib/time";
import { loadWorkouts } from "@/lib/workouts";
import { LeaderboardView, type BoardEntry, type BoardOption } from "./leaderboard-view";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  await requireActiveMember();
  const sp = await searchParams;
  const { timeZone } = await getClubSettings();
  const today = todayKey(timeZone);
  const supabase = await createClient();

  const [workouts, { data: benchmarks }] = await Promise.all([
    loadWorkouts({ from: addDays(today, -30), to: today }),
    supabase.rpc("benchmark_names"),
  ]);

  const sectionOptions: BoardOption[] = workouts.flatMap((w) =>
    w.sections
      .filter((s) => s.scoring !== "none")
      .map((s) => ({
        kind: "section" as const,
        id: s.id,
        name: s.title === w.title ? w.title : `${w.title} · ${s.title}`,
        when: w.workout_date === today ? "Today" : formatDateKey(w.workout_date!, { weekday: "short", month: "short", day: "numeric" }),
        scoring: s.scoring,
      })),
  );
  const benchmarkOptions: BoardOption[] = (benchmarks ?? []).map((b) => ({
    kind: "benchmark" as const,
    id: b.benchmark_name,
    name: b.benchmark_name,
    when: "All-time best",
    scoring: null,
  }));
  const options = [...sectionOptions, ...benchmarkOptions];

  const requestedSection = typeof sp.section === "string" ? sp.section : null;
  const requestedBenchmark = typeof sp.benchmark === "string" ? sp.benchmark : null;
  async function load(o: BoardOption): Promise<BoardEntry[]> {
    if (o.kind === "section") {
      const { data } = await supabase.rpc("section_leaderboard", { p_section: o.id });
      return (data ?? []).map((r) => ({ ...r, scoring: o.scoring! }));
    }
    const { data } = await supabase.rpc("benchmark_leaderboard", { p_benchmark: o.id });
    return (data ?? []).map((r) => ({ ...r }));
  }

  const requested =
    options.find((o) => o.kind === "section" && o.id === requestedSection) ??
    options.find((o) => o.kind === "benchmark" && o.id.toLowerCase() === requestedBenchmark?.toLowerCase()) ??
    null;

  let selected: BoardOption | null = requested;
  let entries: BoardEntry[] = requested ? await load(requested) : [];
  if (!requested) {
    // Open on the most recent board that has scores (checks a handful at most).
    for (const o of options.slice(0, 6)) {
      const e = await load(o);
      if (e.length) {
        selected = o;
        entries = e;
        break;
      }
    }
    if (!selected) selected = options[0] ?? null;
  }

  return <LeaderboardView options={options} selected={selected} entries={entries} />;
}
