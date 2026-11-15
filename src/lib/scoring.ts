import type { Discipline, ScoringType, SectionKind } from "@/lib/supabase/database.types";

export const SCORING_OPTIONS: ReadonlyArray<{ value: ScoringType; label: string; hint: string }> = [
  { value: "none", label: "Not scored", hint: "Warm-up, skill or cooldown" },
  { value: "for_time", label: "For time", hint: "Fastest time wins; capped athletes ranked by reps" },
  { value: "amrap", label: "AMRAP", hint: "Most rounds + reps" },
  { value: "emom", label: "EMOM", hint: "Total reps or rounds completed" },
  { value: "sets_reps", label: "Strength sets", hint: "Sets × reps @ load; top set compared" },
  { value: "max_weight", label: "Max weight", hint: "Heaviest load, e.g. 3RM" },
  { value: "max_reps", label: "Max reps", hint: "Most reps" },
  { value: "time_trial", label: "Distance for time", hint: "Fixed distance, fastest time and pace" },
  { value: "distance", label: "Max distance", hint: "Longest distance in a fixed time" },
  { value: "calories", label: "Calories", hint: "Most calories" },
];

export const SECTION_KIND_OPTIONS: ReadonlyArray<{ value: SectionKind; label: string }> = [
  { value: "warmup", label: "Warm-up" },
  { value: "strength", label: "Strength" },
  { value: "conditioning", label: "Conditioning" },
  { value: "skill", label: "Skill" },
  { value: "accessory", label: "Accessory" },
  { value: "cooldown", label: "Cooldown" },
];

export const DISCIPLINES: ReadonlyArray<{ value: Discipline; label: string; color: string }> = [
  { value: "crossfit", label: "CrossFit", color: "var(--color-accent)" },
  { value: "hyrox", label: "HYROX", color: "var(--color-hyrox)" },
  { value: "strength", label: "Strength", color: "var(--color-strength)" },
  { value: "conditioning", label: "Conditioning", color: "var(--color-conditioning)" },
  { value: "mobility", label: "Mobility", color: "var(--color-recovery)" },
  { value: "open_gym", label: "Open Gym", color: "var(--color-fog)" },
];

export function disciplineMeta(d: Discipline) {
  return DISCIPLINES.find((x) => x.value === d) ?? DISCIPLINES[0];
}

export function scoringLabel(s: ScoringType) {
  return SCORING_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

/** Scoring types whose result is entered as strength sets. */
export function usesSets(s: ScoringType) {
  return s === "sets_reps" || s === "max_weight";
}

/** 754 -> "12:34", 4722 -> "1:18:42" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Parses "12:34", "1:02:03", "754" or "12m 34s" into seconds. */
export function parseDuration(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t) > 0 ? Number(t) : null;
  const colon = t.split(":");
  if (colon.length >= 2 && colon.length <= 3 && colon.every((p) => /^\d+$/.test(p))) {
    const nums = colon.map(Number);
    if (nums.slice(1).some((n) => n >= 60)) return null;
    const secs = nums.reduce((acc, n) => acc * 60 + n, 0);
    return secs > 0 ? secs : null;
  }
  const m = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i.exec(t);
  if (m && (m[1] || m[2] || m[3])) {
    const secs = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
    return secs > 0 ? secs : null;
  }
  return null;
}

/** Pace per 500 m (rowing/ski) or per km (running). */
export function formatPace(seconds: number, meters: number, per: 500 | 1000 = 500): string {
  if (!meters) return "";
  return `${formatDuration((seconds / meters) * per)}/${per === 500 ? "500m" : "km"}`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${Number((meters / 1000).toFixed(2))} km` : `${Math.round(meters)} m`;
}

export type ScoreFields = {
  scoring: ScoringType;
  time_seconds?: number | null;
  capped?: boolean | null;
  rounds?: number | null;
  reps?: number | null;
  load_lbs?: number | null;
  distance_m?: number | null;
  calories?: number | null;
};

/** Human-readable score, e.g. "13:42", "CAP +120", "5 + 12", "265 lb". */
export function formatScore(r: ScoreFields): string {
  switch (r.scoring) {
    case "for_time":
      return r.capped ? `CAP +${r.reps ?? 0}` : r.time_seconds ? formatDuration(r.time_seconds) : "—";
    case "time_trial":
      return r.time_seconds ? formatDuration(r.time_seconds) : "—";
    case "amrap":
    case "emom":
      if (r.rounds != null && r.rounds > 0) return r.reps ? `${r.rounds} + ${r.reps}` : `${r.rounds} rds`;
      return `${r.reps ?? 0} reps`;
    case "max_weight":
    case "sets_reps":
      return r.load_lbs != null ? `${Number(r.load_lbs)} lb` : "—";
    case "max_reps":
      return `${r.reps ?? 0} reps`;
    case "distance":
      return r.distance_m != null ? formatDistance(Number(r.distance_m)) : "—";
    case "calories":
      return `${r.calories ?? 0} cal`;
    default:
      return "—";
  }
}

/** Epley estimate; a single is its own 1RM. */
export function estimate1RM(load: number, reps: number): number {
  if (reps <= 0 || load <= 0) return 0;
  if (reps === 1) return load;
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

export type LevelFilter = "all" | "1" | "2";
export type RxFilter = "all" | "rx" | "scaled";

export function levelLabel(level: number | null | undefined, rx: boolean) {
  const l = level ? `Level ${level}` : "";
  return [l, rx ? "Rx" : "Scaled"].filter(Boolean).join(" · ");
}
