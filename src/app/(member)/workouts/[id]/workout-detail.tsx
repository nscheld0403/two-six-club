"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon, ChevronLeftIcon, PlusIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Display, Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { disciplineMeta, scoringLabel } from "@/lib/scoring";
import { formatDateKey } from "@/lib/time";
import type { WorkoutWithSections } from "@/lib/workouts";

const LEVEL_KEY = "two-six:level";

function capLabel(seconds: number | null) {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} cap`;
}

export function WorkoutDetail({ workout, loggedSectionIds }: { workout: WorkoutWithSections; loggedSectionIds: string[] }) {
  const [level, setLevel] = useState<1 | 2>(2);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LEVEL_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a per-device preference after hydration
      if (saved === "1" || saved === "2") setLevel(Number(saved) as 1 | 2);
    } catch {
      /* storage unavailable */
    }
  }, []);
  function pick(l: 1 | 2) {
    setLevel(l);
    try {
      window.localStorage.setItem(LEVEL_KEY, String(l));
    } catch {
      /* ignore */
    }
  }

  const meta = disciplineMeta(workout.discipline);
  const hasLevels = workout.sections.some((s) => s.level1 && s.level2 && s.level1 !== s.level2);
  const firstScored = workout.sections.find((s) => s.scoring !== "none" && !loggedSectionIds.includes(s.id));

  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="Back"
          className="press flex size-11 items-center justify-center rounded-full border border-hairline"
        >
          <ChevronLeftIcon size={18} />
        </Link>
        <span className="text-[13px] font-semibold text-mist">
          {workout.workout_date ? formatDateKey(workout.workout_date, { weekday: "short", month: "short", day: "numeric" }) : ""}
        </span>
        <span className="size-11" />
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold tracking-[0.1em] text-accent-ink"
            style={{ background: meta.color }}
          >
            {meta.label.toUpperCase()}
          </span>
        </div>
        <Display size="display" className="text-[60px] leading-[0.88]">
          {workout.title}
        </Display>
        {workout.summary ? <p className="m-0 text-[15px] leading-normal text-fog">{workout.summary}</p> : null}
      </section>

      {hasLevels ? (
        <div role="tablist" aria-label="Scaling level" className="flex rounded-button border border-line bg-charcoal p-1">
          {([1, 2] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={level === l}
              onClick={() => pick(l)}
              className={cn(
                "press flex h-11 flex-1 flex-col items-center justify-center rounded-[10px] text-sm font-bold leading-tight",
                level === l ? "bg-chalk text-matte" : "text-mist",
              )}
            >
              Level {l}
              <span className="text-[10.5px] font-semibold opacity-70">{l === 1 ? "Foundations" : "Performance · Rx"}</span>
            </button>
          ))}
        </div>
      ) : null}

      {workout.sections.map((s, i) => {
        const text = (level === 1 ? s.level1 || s.level2 : s.level2 || s.level1) ?? "";
        const scored = s.scoring !== "none";
        const logged = loggedSectionIds.includes(s.id);
        return (
          <section key={s.id} className="rounded-[20px] border border-line bg-charcoal px-4 pb-4 pt-4">
            <div className="flex items-center gap-3 border-b border-line pb-3">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-[10px] font-display text-xl font-extrabold",
                  s.kind === "conditioning" ? "bg-accent text-accent-ink" : "bg-graphite",
                )}
              >
                {String.fromCharCode(65 + i)}
              </div>
              <div className="min-w-0 flex-1">
                <Eyebrow>{s.kind}</Eyebrow>
                <h2 className="m-0 mt-px truncate text-[17px] font-bold">{s.title}</h2>
              </div>
              {logged ? <Badge tone="accent">Logged</Badge> : null}
            </div>
            {scored || s.time_cap_seconds ? (
              <div className="pt-3 text-[13px] font-semibold text-accent">
                {[scored ? scoringLabel(s.scoring) : null, s.rounds_target ? `${s.rounds_target} rounds` : null, capLabel(s.time_cap_seconds)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
            {text ? (
              <div className="whitespace-pre-line pt-3 text-[15px] leading-relaxed text-chalk">{text}</div>
            ) : null}
            {s.notes ? (
              <div className="mt-3 rounded-xl bg-graphite px-3 py-2.5 text-[13px] leading-normal text-fog">{s.notes}</div>
            ) : null}
            {scored ? (
              <div className="pt-3">
                <Link
                  href={`/log/${s.id}?level=${level}`}
                  className={cn(
                    "press inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold",
                    logged ? "bg-accent/14 text-accent" : "border border-hairline text-fog",
                  )}
                >
                  {logged ? <CheckIcon size={14} /> : <PlusIcon size={14} />}
                  {logged ? "Edit my result" : "Log result"}
                </Link>
              </div>
            ) : null}
          </section>
        );
      })}

      {workout.coach_notes ? (
        <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-charcoal p-4">
          <div className="text-sm font-bold">Coach&apos;s notes</div>
          <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-fog">{workout.coach_notes}</p>
        </section>
      ) : null}

      {firstScored ? (
        <div className="sticky bottom-[96px] z-10">
          <ButtonLink href={`/log/${firstScored.id}?level=${level}`} size="lg" className="w-full shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <PlusIcon size={18} /> Log Level {level} result
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}
