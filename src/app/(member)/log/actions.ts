"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveMember } from "@/lib/auth";
import { formatScore } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import type { ScoringType } from "@/lib/supabase/database.types";

const scoring = z.enum([
  "for_time",
  "amrap",
  "emom",
  "max_weight",
  "max_reps",
  "distance",
  "time_trial",
  "calories",
  "sets_reps",
]);

const optInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable().optional();

const resultInput = z
  .object({
    resultId: z.uuid().nullable().optional(),
    sectionId: z.uuid().nullable().optional(),
    performedOn: z.iso.date(),
    title: z.string().trim().min(1).max(80),
    scoring,
    movementId: z.uuid().nullable().optional(),
    benchmarkName: z.string().trim().max(60).nullable().optional(),
    level: z.union([z.literal(1), z.literal(2)]).nullable().optional(),
    rx: z.boolean(),
    timeSeconds: optInt(1, 86400),
    capped: z.boolean().optional(),
    rounds: optInt(0, 999),
    reps: optInt(0, 99999),
    distanceM: z.number().positive().max(1_000_000).nullable().optional(),
    calories: optInt(1, 99999),
    rpe: optInt(1, 10),
    notes: z.string().trim().max(1000).nullable().optional(),
    sets: z
      .array(z.object({ reps: z.number().int().min(1).max(100), load: z.number().min(0).max(1999) }))
      .max(50)
      .optional(),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", message });
    };
    switch (v.scoring) {
      case "for_time":
        need(v.capped ? v.reps != null : v.timeSeconds != null, v.capped ? "Enter the reps you completed" : "Enter your time");
        break;
      case "time_trial":
        need(v.timeSeconds != null, "Enter your time");
        need(v.distanceM != null, "Enter the distance");
        break;
      case "amrap":
      case "emom":
        need(v.rounds != null || v.reps != null, "Enter rounds or reps");
        break;
      case "max_reps":
        need(v.reps != null, "Enter your reps");
        break;
      case "distance":
        need(v.distanceM != null, "Enter the distance");
        break;
      case "calories":
        need(v.calories != null, "Enter calories");
        break;
      case "sets_reps":
      case "max_weight":
        need(!!v.sets?.some((s) => s.load > 0), "Add at least one set with a load");
        need(!!v.movementId, "Choose the movement");
        break;
    }
  });

export type ResultInput = z.input<typeof resultInput>;
export type SaveResultResponse =
  | { ok: true; resultId: string; score: string; prs: string[]; sectionId: string | null }
  | { ok: false; message: string };

export async function saveResult(raw: ResultInput): Promise<SaveResultResponse> {
  const me = await requireActiveMember();
  const parsed = resultInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your result" };
  const v = parsed.data;
  const supabase = await createClient();

  const usesSets = v.scoring === "sets_reps" || v.scoring === "max_weight";
  const sets = usesSets ? (v.sets ?? []).filter((s) => s.load > 0) : [];
  const topLoad = sets.length ? Math.max(...sets.map((s) => s.load)) : null;

  // --- PR check against history *before* this save ---------------------------
  const prs: string[] = [];
  if (usesSets && v.movementId) {
    const { data: bests } = await supabase
      .from("lift_bests")
      .select("reps, load_lbs, result_id, movement_name")
      .eq("member_id", me.id)
      .eq("movement_id", v.movementId);
    const prior = (bests ?? []).filter((b) => b.result_id !== v.resultId);
    const bestByReps = new Map<number, number>();
    for (const s of sets) bestByReps.set(s.reps, Math.max(bestByReps.get(s.reps) ?? 0, s.load));
    for (const [reps, load] of bestByReps) {
      const before = prior.find((b) => b.reps === reps);
      if (!before || load > Number(before.load_lbs)) {
        if (before || prior.length > 0) prs.push(`${reps}RM ${load} lb${before ? ` (+${load - Number(before.load_lbs)})` : ""}`);
      }
    }
  }

  let priorBenchmark: number | null = null;
  if (v.benchmarkName) {
    const { data: bb } = await supabase
      .from("benchmark_bests")
      .select("score_value, result_id, benchmark_name")
      .eq("member_id", me.id)
      .eq("rx", v.rx)
      .ilike("benchmark_name", v.benchmarkName);
    const other = (bb ?? []).filter((b) => b.result_id !== v.resultId);
    priorBenchmark = other.length ? Math.max(...other.map((b) => Number(b.score_value))) : null;
  }

  const row = {
    member_id: me.id,
    section_id: v.sectionId ?? null,
    performed_on: v.performedOn,
    title: v.title,
    scoring: v.scoring as ScoringType,
    movement_id: v.movementId ?? null,
    benchmark_name: v.benchmarkName || null,
    level: v.level ?? null,
    rx: v.rx,
    time_seconds: v.scoring === "for_time" && v.capped ? null : (v.timeSeconds ?? null),
    capped: v.scoring === "for_time" ? Boolean(v.capped) : false,
    rounds: v.rounds ?? null,
    reps: v.reps ?? null,
    load_lbs: usesSets ? topLoad : null,
    distance_m: v.distanceM ?? null,
    calories: v.calories ?? null,
    rpe: v.rpe ?? null,
    notes: v.notes || null,
  };

  const write = v.resultId
    ? supabase.from("results").update(row).eq("id", v.resultId).eq("member_id", me.id).select("id, score_value").single()
    : supabase.from("results").insert(row).select("id, score_value").single();
  const { data: saved, error } = await write;
  if (error || !saved) {
    if (error?.code === "23505") return { ok: false, message: "You've already logged this workout. Open it to edit your result." };
    console.error("saveResult failed", error);
    return { ok: false, message: error?.code === "23514" ? error.message : "Couldn't save your result. Try again." };
  }

  if (usesSets) {
    await supabase.from("result_sets").delete().eq("result_id", saved.id);
    if (sets.length) {
      const { error: setsError } = await supabase
        .from("result_sets")
        .insert(sets.map((s, i) => ({ result_id: saved.id, set_no: i + 1, reps: s.reps, load_lbs: s.load })));
      if (setsError) {
        console.error("saving sets failed", setsError);
        return { ok: false, message: "Saved the result but not the sets. Try saving again." };
      }
    }
  }

  if (v.benchmarkName && priorBenchmark != null && Number(saved.score_value) > priorBenchmark) {
    prs.push(`${v.benchmarkName} best`);
  }

  revalidatePath("/log");
  revalidatePath("/progress");
  revalidatePath("/leaderboard");
  return {
    ok: true,
    resultId: saved.id,
    sectionId: v.sectionId ?? null,
    prs,
    score: formatScore({
      scoring: v.scoring,
      time_seconds: row.time_seconds,
      capped: row.capped,
      rounds: row.rounds,
      reps: row.reps,
      load_lbs: row.load_lbs,
      distance_m: row.distance_m,
      calories: row.calories,
    }),
  };
}

export async function deleteResult(resultId: string): Promise<{ ok: boolean }> {
  const me = await requireActiveMember();
  const id = z.uuid().safeParse(resultId);
  if (!id.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("results").delete().eq("id", id.data).eq("member_id", me.id);
  revalidatePath("/log");
  revalidatePath("/progress");
  revalidatePath("/leaderboard");
  return { ok: !error };
}
