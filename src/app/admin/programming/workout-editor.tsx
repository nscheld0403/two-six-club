"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeftIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { Card, Display, Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DISCIPLINES, SCORING_OPTIONS, SECTION_KIND_OPTIONS, usesSets } from "@/lib/scoring";
import type { Discipline, ScoringType, SectionKind, WorkoutStatus } from "@/lib/supabase/database.types";
import { formatDateKey, localTimeOf, dateKeyIn, zonedToUtc } from "@/lib/time";
import { deleteWorkout, saveWorkout } from "./actions";

export type EditorSection = {
  id: string | null;
  kind: SectionKind;
  title: string;
  scoring: ScoringType;
  movementId: string | null;
  benchmarkName: string;
  timeCapSeconds: number | null;
  roundsTarget: number | null;
  distanceM: number | null;
  level1: string;
  level2: string;
  notes: string;
};

export type EditorWorkout = {
  id: string | null;
  title: string;
  workoutDate: string | null;
  discipline: Discipline;
  summary: string;
  coachNotes: string;
  status: WorkoutStatus;
  publishAt: string | null;
  isTemplate: boolean;
  sections: EditorSection[];
};

const input = cn(inputClasses, "h-12 bg-matte text-[15px]");
const area = cn(inputClasses, "h-auto min-h-[96px] resize-y bg-matte py-3 text-[15px] leading-relaxed");
const labelCls = "flex flex-col gap-1.5 text-xs font-semibold text-mist";

const blankSection = (): EditorSection => ({
  id: null,
  kind: "conditioning",
  title: "",
  scoring: "for_time",
  movementId: null,
  benchmarkName: "",
  timeCapSeconds: null,
  roundsTarget: null,
  distanceM: null,
  level1: "",
  level2: "",
  notes: "",
});

export function WorkoutEditor({
  initial,
  movements,
  timeZone,
}: {
  initial: EditorWorkout;
  movements: Array<{ id: string; name: string }>;
  timeZone: string;
}) {
  const router = useRouter();
  const [w, setW] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [reveal, setReveal] = useState(Boolean(initial.publishAt));
  const [revealDate, setRevealDate] = useState(initial.publishAt ? dateKeyIn(new Date(initial.publishAt), timeZone) : initial.workoutDate ?? "");
  const [revealTime, setRevealTime] = useState(initial.publishAt ? localTimeOf(initial.publishAt, timeZone) : "05:00");

  const set = <K extends keyof EditorWorkout>(k: K, v: EditorWorkout[K]) => setW((x) => ({ ...x, [k]: v }));
  const setSection = (i: number, patch: Partial<EditorSection>) =>
    setW((x) => ({ ...x, sections: x.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) =>
    setW((x) => {
      const s = [...x.sections];
      const j = i + d;
      if (j < 0 || j >= s.length) return x;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...x, sections: s };
    });

  function save(opts: { status?: WorkoutStatus; asTemplate?: boolean }) {
    setError(null);
    setNotice(null);
    const asTemplate = Boolean(opts.asTemplate);
    const payload = {
      id: asTemplate && !w.isTemplate ? null : w.id,
      title: w.title,
      workoutDate: asTemplate ? null : w.workoutDate,
      discipline: w.discipline,
      summary: w.summary,
      coachNotes: w.coachNotes,
      status: opts.status ?? w.status,
      publishAt: !asTemplate && reveal && revealDate ? zonedToUtc(revealDate, revealTime || "00:00", timeZone).toISOString() : null,
      isTemplate: asTemplate || w.isTemplate,
      sections: w.sections.map((s) => ({
        id: asTemplate && !w.isTemplate ? null : s.id,
        kind: s.kind,
        title: s.title,
        scoring: s.scoring,
        movementId: s.movementId,
        benchmarkName: s.benchmarkName || null,
        timeCapSeconds: s.timeCapSeconds,
        roundsTarget: s.roundsTarget,
        distanceM: s.distanceM,
        level1: s.level1,
        level2: s.level2,
        notes: s.notes,
      })),
    };
    start(async () => {
      const r = await saveWorkout(payload);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (asTemplate && !w.isTemplate) {
        setNotice("Saved a copy as a template.");
        router.refresh();
        return;
      }
      if (opts.status) set("status", opts.status);
      setNotice(opts.status === "published" ? "Published to members." : "Saved.");
      if (!w.id) router.replace(`/admin/programming/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={w.workoutDate ? `/admin/programming?week=${w.workoutDate}` : "/admin/programming"} aria-label="Back to programming" className="press flex size-11 items-center justify-center rounded-full border border-hairline">
            <ChevronLeftIcon size={18} />
          </Link>
          <div>
            <Eyebrow className="text-xs">
              {w.isTemplate ? "Template" : w.workoutDate ? formatDateKey(w.workoutDate, { weekday: "long", month: "long", day: "numeric" }) : "New workout"}
              {" · "}
              {w.isTemplate ? "reusable" : w.status === "published" ? "Live" : "Draft"}
            </Eyebrow>
            <Display className="text-[32px]">{w.id ? "Edit workout" : w.isTemplate ? "New template" : "New workout"}</Display>
          </div>
        </div>
      </header>

      {notice ? <div role="status" className="rounded-button border border-accent/40 bg-accent/12 px-4 py-3 text-sm">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-button border border-conditioning/40 bg-conditioning/12 px-4 py-3 text-sm text-conditioning">{error}</div> : null}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          <Card className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 p-5">
            <label className={cn(labelCls, "col-span-full sm:col-span-2")}>
              Name
              <input value={w.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="e.g. Engine Room" className={input} />
            </label>
            {!w.isTemplate ? (
              <label className={labelCls}>
                Date
                <input type="date" value={w.workoutDate ?? ""} onChange={(e) => set("workoutDate", e.target.value)} className={cn(input, "[color-scheme:dark]")} />
              </label>
            ) : null}
            <label className={labelCls}>
              Type
              <select value={w.discipline} onChange={(e) => set("discipline", e.target.value as Discipline)} className={input}>
                {DISCIPLINES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={cn(labelCls, "col-span-full")}>
              One-line summary (shown on Home)
              <input value={w.summary} onChange={(e) => set("summary", e.target.value)} maxLength={500} placeholder="Back squat 5×3, then 3 rounds for time" className={input} />
            </label>
          </Card>

          {w.sections.map((s, i) => (
            <Card key={i} className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className={cn("flex size-9 flex-none items-center justify-center rounded-[10px] font-display text-xl font-extrabold", s.scoring !== "none" ? "bg-accent text-accent-ink" : "bg-graphite")}>
                  {String.fromCharCode(65 + i)}
                </div>
                <input value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} aria-label={`Section ${i + 1} title`} placeholder="Section title" maxLength={80} className={cn(input, "flex-1 font-semibold")} />
                <div className="flex gap-1">
                  <Button variant="secondary" size="sm" className="size-10 rounded-[10px] px-0" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button variant="secondary" size="sm" className="size-10 rounded-[10px] px-0" aria-label="Move down" disabled={i === w.sections.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                  <Button variant="danger" size="sm" className="size-10 rounded-[10px] px-0" aria-label="Remove section" onClick={() => setW((x) => ({ ...x, sections: x.sections.filter((_, j) => j !== i) }))}>
                    ×
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                <label className={labelCls}>
                  Part
                  <select value={s.kind} onChange={(e) => setSection(i, { kind: e.target.value as SectionKind })} className={input}>
                    {SECTION_KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  Scoring
                  <select value={s.scoring} onChange={(e) => setSection(i, { scoring: e.target.value as ScoringType })} className={input}>
                    {SCORING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {usesSets(s.scoring) ? (
                  <label className={labelCls}>
                    Movement
                    <select value={s.movementId ?? ""} onChange={(e) => setSection(i, { movementId: e.target.value || null })} className={input}>
                      <option value="">Choose…</option>
                      {movements.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {s.scoring === "for_time" || s.scoring === "amrap" || s.scoring === "emom" || s.scoring === "distance" || s.scoring === "calories" ? (
                  <label className={labelCls}>
                    {s.scoring === "for_time" ? "Time cap (min)" : "Duration (min)"}
                    <input inputMode="numeric" value={s.timeCapSeconds ? s.timeCapSeconds / 60 : ""} onChange={(e) => setSection(i, { timeCapSeconds: Number(e.target.value.replace(/\D/g, "")) * 60 || null })} className={input} />
                  </label>
                ) : null}
                {s.scoring === "for_time" || s.scoring === "amrap" ? (
                  <label className={labelCls}>
                    Rounds
                    <input inputMode="numeric" value={s.roundsTarget ?? ""} onChange={(e) => setSection(i, { roundsTarget: Number(e.target.value.replace(/\D/g, "")) || null })} className={input} />
                  </label>
                ) : null}
                {s.scoring === "time_trial" ? (
                  <label className={labelCls}>
                    Distance (m)
                    <input inputMode="numeric" value={s.distanceM ?? ""} onChange={(e) => setSection(i, { distanceM: Number(e.target.value.replace(/\D/g, "")) || null })} className={input} />
                  </label>
                ) : null}
                {s.scoring !== "none" ? (
                  <label className={labelCls}>
                    Benchmark name (optional)
                    <input value={s.benchmarkName} onChange={(e) => setSection(i, { benchmarkName: e.target.value })} maxLength={60} placeholder="e.g. Fran, 2k Row" className={input} />
                  </label>
                ) : null}
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                <label className={labelCls}>
                  Level 1 · Foundations
                  <textarea value={s.level1} onChange={(e) => setSection(i, { level1: e.target.value })} maxLength={2000} className={area} placeholder={"400 m row\n15 wall balls 14/10 lb"} />
                </label>
                <label className={labelCls}>
                  Level 2 · Performance (Rx)
                  <textarea value={s.level2} onChange={(e) => setSection(i, { level2: e.target.value })} maxLength={2000} className={area} placeholder={"500 m row\n15 wall balls 20/14 lb"} />
                </label>
              </div>
              <label className={labelCls}>
                Notes for this part (optional)
                <input value={s.notes} onChange={(e) => setSection(i, { notes: e.target.value })} maxLength={1000} className={input} />
              </label>
            </Card>
          ))}

          <Button variant="secondary" size="md" onClick={() => setW((x) => ({ ...x, sections: [...x.sections, blankSection()] }))} disabled={w.sections.length >= 12}>
            <PlusIcon size={16} /> Add section
          </Button>

          <Card className="p-5">
            <label className={labelCls}>
              Coach&apos;s notes (shown at the bottom of the workout)
              <textarea value={w.coachNotes} onChange={(e) => set("coachNotes", e.target.value)} maxLength={2000} className={area} />
            </label>
          </Card>
        </div>

        <aside className="sticky top-6 flex min-w-0 flex-[1_1_260px] flex-col gap-3">
          <Card className="flex flex-col gap-3 p-5">
            {w.isTemplate ? (
              <>
                <p className="m-0 text-sm text-mist">Templates are never shown to members. Use one from the Programming page to make a dated workout.</p>
                <Button disabled={pending} onClick={() => save({})}>
                  {pending ? "Saving…" : "Save template"}
                </Button>
              </>
            ) : (
              <>
                <label className="flex items-center gap-3 text-sm text-fog">
                  <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
                  Reveal at a set time
                </label>
                {reveal ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" aria-label="Reveal date" value={revealDate} onChange={(e) => setRevealDate(e.target.value)} className={cn(input, "[color-scheme:dark]")} />
                    <input type="time" aria-label="Reveal time" value={revealTime} onChange={(e) => setRevealTime(e.target.value)} className={cn(input, "[color-scheme:dark]")} />
                  </div>
                ) : null}
                <Button disabled={pending} onClick={() => save({ status: "published" })}>
                  {pending ? "Saving…" : w.status === "published" ? "Save & keep live" : reveal ? "Schedule reveal" : "Publish to members"}
                </Button>
                {w.status === "published" ? (
                  <Button variant="secondary" disabled={pending} onClick={() => save({ status: "draft" })}>
                    Unpublish (back to draft)
                  </Button>
                ) : (
                  <Button variant="secondary" disabled={pending} onClick={() => save({ status: "draft" })}>
                    Save draft
                  </Button>
                )}
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => save({ asTemplate: true })}>
                  Save a copy as template
                </Button>
              </>
            )}
            {w.id ? (
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Delete this workout?")) return;
                  start(async () => {
                    const r = await deleteWorkout(w.id!);
                    if (!r.ok) setError(r.message);
                    else router.replace("/admin/programming");
                  });
                }}
              >
                Delete
              </Button>
            ) : null}
          </Card>
          <p className="m-0 px-1 text-xs leading-relaxed text-ash">
            Members choose Level 1 or Level 2 on the workout screen. If you only fill in one level, everyone sees that one.
            Strength sections track PRs per movement, and benchmark names build all-time leaderboards.
          </p>
        </aside>
      </div>
    </div>
  );
}
