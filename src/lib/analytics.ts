import { addDays, formatDateKey, mondayOf, type DateKey } from "@/lib/time";

export type ActivityEvent = { date: DateKey; kind: "result" | "class" };

/** Last `weeks` Monday-start weeks ending with the week of `today`, oldest first. */
export function weekBuckets(today: DateKey, weeks: number): DateKey[] {
  const thisMonday = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => addDays(thisMonday, -7 * (weeks - 1 - i)));
}

export function monthBuckets(today: DateKey, months: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const idx = y * 12 + (m - 1) - (months - 1 - i);
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  });
}

/** Training days per week: a day counts once even with a class and a log. */
export function weeklyActivity(events: ActivityEvent[], today: DateKey, weeks = 12) {
  const buckets = weekBuckets(today, weeks);
  const days = new Map<DateKey, Set<DateKey>>();
  const classes = new Map<DateKey, number>();
  for (const e of events) {
    const wk = mondayOf(e.date);
    if (!days.has(wk)) days.set(wk, new Set());
    days.get(wk)!.add(e.date);
    if (e.kind === "class") classes.set(wk, (classes.get(wk) ?? 0) + 1);
  }
  return buckets.map((wk) => ({
    key: wk,
    label: formatDateKey(wk, { month: "short", day: "numeric" }),
    days: days.get(wk)?.size ?? 0,
    classes: classes.get(wk) ?? 0,
  }));
}

export function monthlyActivity(events: ActivityEvent[], today: DateKey, months = 12) {
  const buckets = monthBuckets(today, months);
  const days = new Map<string, Set<DateKey>>();
  const classes = new Map<string, number>();
  for (const e of events) {
    const mk = e.date.slice(0, 7);
    if (!days.has(mk)) days.set(mk, new Set());
    days.get(mk)!.add(e.date);
    if (e.kind === "class") classes.set(mk, (classes.get(mk) ?? 0) + 1);
  }
  return buckets.map((mk) => ({
    key: mk,
    label: formatDateKey(`${mk}-01`, { month: "short" }),
    days: days.get(mk)?.size ?? 0,
    classes: classes.get(mk) ?? 0,
  }));
}

/** Consecutive weeks (ending this week, or last week if this week is empty) with any activity. */
export function weekStreak(events: ActivityEvent[], today: DateKey): number {
  const active = new Set(events.map((e) => mondayOf(e.date)));
  let wk = mondayOf(today);
  if (!active.has(wk)) wk = addDays(wk, -7);
  let n = 0;
  while (active.has(wk)) {
    n++;
    wk = addDays(wk, -7);
  }
  return n;
}

/** Weekly strength volume (sum of reps × load), oldest first. */
export function weeklyVolume(rows: Array<{ performed_on: DateKey; volume_lbs: number }>, today: DateKey, weeks = 12) {
  const buckets = weekBuckets(today, weeks);
  const sums = new Map<DateKey, number>();
  for (const r of rows) {
    const wk = mondayOf(r.performed_on);
    sums.set(wk, (sums.get(wk) ?? 0) + Number(r.volume_lbs));
  }
  return buckets.map((wk) => ({
    key: wk,
    label: formatDateKey(wk, { month: "short", day: "numeric" }),
    volume: Math.round(sums.get(wk) ?? 0),
  }));
}

/** First vs best attempt per benchmark (score_value: higher is better). */
export function benchmarkProgress<T extends { benchmark_name: string | null; performed_on: DateKey; score_value: number | null; rx: boolean }>(
  results: T[],
) {
  const groups = new Map<string, T[]>();
  for (const r of results) {
    if (!r.benchmark_name || r.score_value == null) continue;
    const k = `${r.benchmark_name.toLowerCase()}|${r.rx}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  return Array.from(groups.values())
    .map((list) => {
      const sorted = [...list].sort((a, b) => a.performed_on.localeCompare(b.performed_on));
      const first = sorted[0];
      const best = sorted.reduce((b, r) => (Number(r.score_value) > Number(b.score_value) ? r : b), first);
      const latest = sorted[sorted.length - 1];
      return { name: first.benchmark_name!, rx: first.rx, attempts: sorted.length, first, best, latest, improved: best !== first };
    })
    .sort((a, b) => b.latest.performed_on.localeCompare(a.latest.performed_on));
}
