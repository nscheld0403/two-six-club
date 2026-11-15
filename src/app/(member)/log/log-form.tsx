"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon, ChevronLeftIcon, PlusIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { Card, Display, Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { estimate1RM, formatPace, SCORING_OPTIONS, usesSets } from "@/lib/scoring";
import type { ScoringType } from "@/lib/supabase/database.types";
import { deleteResult, saveResult, type ResultInput } from "./actions";

export type LogFormInitial = {
  resultId: string | null;
  sectionId: string | null;
  title: string;
  subtitle: string;
  scoring: ScoringType;
  movementId: string | null;
  benchmarkName: string | null;
  hasLevels: boolean;
  level: 1 | 2;
  rx: boolean;
  performedOn: string;
  timeCapSeconds: number | null;
  timeSeconds: number | null;
  capped: boolean;
  rounds: number | null;
  reps: number | null;
  distanceM: number | null;
  calories: number | null;
  rpe: number | null;
  notes: string;
  sets: Array<{ reps: number; load: number }>;
  freeForm: boolean;
  backHref: string;
};

const numberOrNull = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

function Stepper({ label, value, onChange, max = 999 }: { label: string; value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-hairline bg-matte p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ash">{label}</div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="press size-11 rounded-full bg-graphite text-xl font-semibold">
          −
        </button>
        <input
          aria-label={label}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0)))}
          className="w-16 bg-transparent text-center font-display text-[46px] font-extrabold leading-none outline-none"
        />
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="press size-11 rounded-full bg-graphite text-xl font-semibold">
          +
        </button>
      </div>
    </div>
  );
}

export function LogForm({
  initial,
  movements,
}: {
  initial: LogFormInitial;
  movements: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ score: string; prs: string[]; sectionId: string | null } | null>(null);

  const [title, setTitle] = useState(initial.title);
  const [scoring, setScoring] = useState<ScoringType>(initial.scoring);
  const [movementId, setMovementId] = useState(initial.movementId ?? "");
  const [benchmark, setBenchmark] = useState(initial.benchmarkName ?? "");
  const [level, setLevel] = useState<1 | 2>(initial.level);
  const [rx, setRx] = useState(initial.rx);
  const [performedOn, setPerformedOn] = useState(initial.performedOn);
  const [capped, setCapped] = useState(initial.capped);
  const [min, setMin] = useState(initial.timeSeconds ? String(Math.floor(initial.timeSeconds / 60)) : "");
  const [sec, setSec] = useState(initial.timeSeconds ? String(initial.timeSeconds % 60).padStart(2, "0") : "");
  const [rounds, setRounds] = useState(initial.rounds ?? 0);
  const [reps, setReps] = useState(initial.reps ?? 0);
  const [distance, setDistance] = useState(initial.distanceM ? String(initial.distanceM) : "");
  const [calories, setCalories] = useState(initial.calories ? String(initial.calories) : "");
  const [rpe, setRpe] = useState<number | null>(initial.rpe);
  const [notes, setNotes] = useState(initial.notes);
  const [sets, setSets] = useState(initial.sets.length ? initial.sets : [{ reps: 5, load: 0 }]);

  const timeSeconds = (() => {
    const m = Number(min || 0);
    const s = Number(sec || 0);
    if (!min && !sec) return null;
    if (s >= 60) return null;
    return m * 60 + s || null;
  })();

  const isTimed = scoring === "for_time" || scoring === "time_trial";

  function updateSet(i: number, patch: Partial<{ reps: number; load: number }>) {
    setSets((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function submit() {
    setError(null);
    const payload: ResultInput = {
      resultId: initial.resultId,
      sectionId: initial.sectionId,
      performedOn,
      title: title.trim(),
      scoring: scoring as ResultInput["scoring"],
      movementId: movementId || null,
      benchmarkName: benchmark.trim() || null,
      level: initial.hasLevels ? level : null,
      rx,
      timeSeconds,
      capped: scoring === "for_time" ? capped : false,
      rounds: scoring === "amrap" || scoring === "emom" || (scoring === "for_time" && capped) ? rounds : null,
      reps:
        scoring === "amrap" || scoring === "emom" || scoring === "max_reps" || (scoring === "for_time" && capped) ? reps : null,
      distanceM: scoring === "distance" || scoring === "time_trial" ? numberOrNull(distance) : null,
      calories: scoring === "calories" ? numberOrNull(calories) : null,
      rpe,
      notes: notes.trim() || null,
      sets: usesSets(scoring) ? sets : undefined,
    };
    if (scoring === "for_time" && capped) payload.rounds = null; // capped: total reps completed
    startTransition(async () => {
      const r = await saveResult(payload);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSaved({ score: r.score, prs: r.prs, sectionId: r.sectionId });
      router.refresh();
    });
  }

  if (saved) {
    return (
      <div className="flex flex-1 flex-col gap-5 pt-6">
        <div className="flex size-16 items-center justify-center rounded-[20px] bg-accent text-accent-ink">
          <CheckIcon size={32} />
        </div>
        <div>
          <Eyebrow className="text-xs">Result saved</Eyebrow>
          <div className="font-display text-[88px] font-extrabold leading-[0.9]">{saved.score}</div>
          <div className="mt-1.5 text-[15px] text-fog">
            {title}
            {initial.hasLevels ? ` · Level ${level}` : ""} · {rx ? "Rx" : "Scaled"}
            {rpe ? ` · RPE ${rpe}` : ""}
          </div>
        </div>
        {saved.prs.length ? (
          <Card className="border-accent/50">
            <Eyebrow className="text-accent">New personal record</Eyebrow>
            <ul className="m-0 mt-1.5 list-none p-0">
              {saved.prs.map((p) => (
                <li key={p} className="font-display text-[26px] font-bold leading-tight">
                  {p}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <div className="flex flex-col gap-2.5">
          {saved.sectionId ? (
            <ButtonLink href={`/leaderboard?section=${saved.sectionId}`} size="lg">
              See leaderboard
            </ButtonLink>
          ) : (
            <ButtonLink href="/progress" size="lg">
              See my progress
            </ButtonLink>
          )}
          <div className="flex gap-2.5">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setSaved(null)}>
              Edit
            </Button>
            <ButtonLink href="/log" variant="secondary" size="md" className="flex-1">
              Done
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href={initial.backHref} aria-label="Back" className="press flex size-11 flex-none items-center justify-center rounded-full border border-hairline">
          <ChevronLeftIcon size={18} />
        </Link>
        <div className="min-w-0">
          <Display as="h1" className="truncate text-[28px] leading-none">
            Log result
          </Display>
          <div className="mt-0.5 truncate text-xs text-mist">{initial.subtitle}</div>
        </div>
      </div>

      {initial.freeForm ? (
        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-fog">
            Type of result
            <select value={scoring} onChange={(e) => setScoring(e.target.value as ScoringType)} className={cn(inputClasses, "bg-matte")}>
              {SCORING_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {usesSets(scoring) ? (
            <label className="flex flex-col gap-2 text-[13px] font-semibold text-fog">
              Movement
              <select
                value={movementId}
                onChange={(e) => {
                  setMovementId(e.target.value);
                  setTitle(movements.find((m) => m.id === e.target.value)?.name ?? "");
                }}
                className={cn(inputClasses, "bg-matte")}
              >
                <option value="">Choose…</option>
                {movements.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-2 text-[13px] font-semibold text-fog">
                Workout name
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fran, 2k Row" maxLength={80} className={cn(inputClasses, "bg-matte")} />
              </label>
              <label className="flex items-center gap-3 text-sm text-fog">
                <input
                  type="checkbox"
                  checked={Boolean(benchmark)}
                  onChange={(e) => setBenchmark(e.target.checked ? title || "Benchmark" : "")}
                  className="size-5 accent-[var(--color-accent)]"
                />
                Benchmark: track my best and rank it all-time
              </label>
            </>
          )}
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-fog">
            Date
            <input type="date" value={performedOn} onChange={(e) => setPerformedOn(e.target.value)} className={cn(inputClasses, "bg-matte [color-scheme:dark]")} />
          </label>
        </Card>
      ) : null}

      <section className="flex flex-col gap-2.5">
        <Eyebrow>Scaling</Eyebrow>
        <div className={cn("grid gap-2", initial.hasLevels ? "grid-cols-2" : "grid-cols-1")}>
          {initial.hasLevels ? (
            <div className="flex rounded-button border border-line bg-charcoal p-1" role="radiogroup" aria-label="Level">
              {([1, 2] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  onClick={() => setLevel(l)}
                  className={cn("press h-11 flex-1 rounded-[10px] text-sm font-bold", level === l ? "bg-chalk text-matte" : "text-mist")}
                >
                  Level {l}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex rounded-button border border-line bg-charcoal p-1" role="radiogroup" aria-label="Rx or scaled">
            {[
              { v: true, l: "Rx" },
              { v: false, l: "Scaled" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={rx === o.v}
                onClick={() => setRx(o.v)}
                className={cn("press h-11 flex-1 rounded-[10px] text-sm font-bold", rx === o.v ? "bg-chalk text-matte" : "text-mist")}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <p className="m-0 text-xs text-ash">Rx means you did the level exactly as written, with no changes.</p>
      </section>

      <Card hero className="flex flex-col gap-4">
        {scoring === "for_time" ? (
          <div className="flex rounded-xl border border-line bg-matte p-1" role="radiogroup" aria-label="Finished or capped">
            {[
              { v: false, l: "Finished" },
              { v: true, l: "Hit the cap" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={capped === o.v}
                onClick={() => setCapped(o.v)}
                className={cn("press h-10 flex-1 rounded-[9px] text-[13px] font-bold", capped === o.v ? "bg-chalk text-matte" : "text-mist")}
              >
                {o.l}
              </button>
            ))}
          </div>
        ) : null}

        {isTimed && !(scoring === "for_time" && capped) ? (
          <div className="flex items-end justify-center gap-2">
            {[
              { l: "MIN", v: min, set: setMin },
              { l: "SEC", v: sec, set: setSec },
            ].map((f, i) => (
              <div key={f.l} className="flex items-end gap-2">
                {i === 1 ? <div className="pb-5 font-display text-6xl font-extrabold text-ash">:</div> : null}
                <label className="flex flex-col items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-ash">
                  {f.l}
                  <input
                    inputMode="numeric"
                    aria-label={f.l === "MIN" ? "Minutes" : "Seconds"}
                    value={f.v}
                    placeholder={f.l === "MIN" ? "00" : "00"}
                    onChange={(e) => f.set(e.target.value.replace(/\D/g, "").slice(0, f.l === "MIN" ? 3 : 2))}
                    className="h-24 w-[120px] rounded-[18px] border-[1.5px] border-hairline bg-matte text-center font-display text-[64px] font-extrabold leading-none text-chalk outline-none focus:border-chalk"
                  />
                </label>
              </div>
            ))}
          </div>
        ) : null}
        {isTimed && Number(sec) >= 60 ? <p className="m-0 text-center text-sm text-conditioning">Seconds must be under 60.</p> : null}
        {initial.timeCapSeconds && scoring === "for_time" && !capped ? (
          <p className="m-0 text-center text-xs text-ash">Time cap {Math.floor(initial.timeCapSeconds / 60)}:00</p>
        ) : null}

        {scoring === "for_time" && capped ? <Stepper label="Reps completed" value={reps} onChange={setReps} max={99999} /> : null}

        {scoring === "amrap" || scoring === "emom" ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Stepper label="Rounds" value={rounds} onChange={setRounds} />
            <Stepper label="+ Reps" value={reps} onChange={setReps} max={9999} />
          </div>
        ) : null}

        {scoring === "max_reps" ? <Stepper label="Reps" value={reps} onChange={setReps} max={99999} /> : null}

        {scoring === "distance" || scoring === "time_trial" ? (
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-fog">
            Distance (meters)
            <input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.]/g, ""))} className={cn(inputClasses, "bg-matte font-display text-2xl font-bold")} />
          </label>
        ) : null}
        {scoring === "time_trial" && timeSeconds && Number(distance) > 0 ? (
          <p className="m-0 text-center text-sm font-semibold text-accent">
            Pace {formatPace(timeSeconds, Number(distance), Number(distance) >= 3000 ? 1000 : 500)}
          </p>
        ) : null}

        {scoring === "calories" ? (
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-fog">
            Calories
            <input inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value.replace(/\D/g, ""))} className={cn(inputClasses, "bg-matte font-display text-2xl font-bold")} />
          </label>
        ) : null}

        {usesSets(scoring) ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between pb-2">
              <Eyebrow>Sets</Eyebrow>
              <span className="text-xs text-mist">
                Best e1RM {Math.max(0, ...sets.filter((s) => s.load > 0 && s.reps <= 10).map((s) => estimate1RM(s.load, s.reps)))} lb
              </span>
            </div>
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2 border-t border-line py-2">
                <div className="w-11 text-[13px] font-semibold text-mist">Set {i + 1}</div>
                <label className="flex items-center gap-1 text-xs text-ash">
                  <input
                    aria-label={`Set ${i + 1} reps`}
                    inputMode="numeric"
                    value={s.reps}
                    onChange={(e) => updateSet(i, { reps: Math.max(1, Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
                    className="h-11 w-12 rounded-xl border border-hairline bg-matte text-center font-display text-xl font-bold text-chalk outline-none focus:border-chalk"
                  />
                  reps
                </label>
                <span className="text-ash">×</span>
                <button type="button" aria-label={`Set ${i + 1} decrease 5 lb`} onClick={() => updateSet(i, { load: Math.max(0, s.load - 5) })} className="press size-11 rounded-xl bg-graphite text-lg">
                  −
                </button>
                <label className="flex flex-1 items-center justify-center gap-1 text-xs text-ash">
                  <input
                    aria-label={`Set ${i + 1} load in pounds`}
                    inputMode="decimal"
                    value={s.load || ""}
                    placeholder="0"
                    onChange={(e) => updateSet(i, { load: Math.min(1999, Number(e.target.value.replace(/[^\d.]/g, "")) || 0) })}
                    className="h-11 w-16 bg-transparent text-right font-display text-[26px] font-bold text-chalk outline-none"
                  />
                  lb
                </label>
                <button type="button" aria-label={`Set ${i + 1} increase 5 lb`} onClick={() => updateSet(i, { load: s.load + 5 })} className="press size-11 rounded-xl bg-graphite text-lg">
                  +
                </button>
              </div>
            ))}
            <div className="flex gap-2 border-t border-line pt-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 bg-matte"
                onClick={() => setSets((all) => [...all, { ...(all[all.length - 1] ?? { reps: 5, load: 0 }) }])}
                disabled={sets.length >= 50}
              >
                <PlusIcon size={14} /> Add set
              </Button>
              {sets.length > 1 ? (
                <Button variant="secondary" size="sm" className="bg-matte" onClick={() => setSets((all) => all.slice(0, -1))}>
                  Remove last
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <section className="flex flex-col gap-2.5">
        <Eyebrow>How hard was it?{rpe ? ` · RPE ${rpe}` : ""}</Eyebrow>
        <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Effort, 1 easy to 10 all-out">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rpe === n}
              aria-label={`RPE ${n}`}
              onClick={() => setRpe(rpe === n ? null : n)}
              className={cn(
                "press h-11 rounded-[10px] font-display text-lg font-bold",
                rpe === n ? "bg-accent text-accent-ink" : rpe && n <= rpe ? "bg-charcoal text-chalk" : "bg-charcoal text-ash",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-ash">
          <span>Easy</span>
          <span>All-out</span>
        </div>
      </section>

      <label className="flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-eyebrow text-ash">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="How did it go?"
          className={cn(inputClasses, "h-auto resize-none py-3.5 text-[15px] normal-case tracking-normal")}
        />
      </label>

      {error ? (
        <p role="alert" className="m-0 rounded-button bg-conditioning/14 px-4 py-3 text-sm font-medium text-conditioning">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-[96px] z-10 flex flex-col gap-2">
        <Button size="lg" className="w-full shadow-[0_8px_24px_rgba(0,0,0,0.5)]" disabled={pending || (isTimed && !capped && Number(sec) >= 60)} onClick={submit}>
          {pending ? "Saving…" : initial.resultId ? "Update result" : "Save result"}
        </Button>
      </div>
      {initial.resultId ? (
        <Button
          variant="danger"
          size="md"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Delete this result?")) return;
            startTransition(async () => {
              await deleteResult(initial.resultId!);
              router.push("/log");
            });
          }}
        >
          Delete result
        </Button>
      ) : null}
    </div>
  );
}
