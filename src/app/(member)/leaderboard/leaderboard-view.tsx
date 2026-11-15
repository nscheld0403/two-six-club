"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatScore, levelLabel, scoringLabel } from "@/lib/scoring";
import type { LeaderboardRow, ScoringType } from "@/lib/supabase/database.types";

export type BoardOption = { kind: "section" | "benchmark"; id: string; name: string; when: string; scoring: ScoringType | null };
export type BoardEntry = LeaderboardRow & { scoring: ScoringType; performed_on?: string };

type Seg<T extends string> = { value: T; label: string };

function Segment<T extends string>({ options, value, onChange, label }: { options: Seg<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-line bg-charcoal p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "press h-[38px] flex-1 rounded-[9px] px-2.5 text-[13px] font-bold",
            value === o.value ? "bg-accent text-accent-ink" : "text-mist",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LeaderboardView({
  options,
  selected,
  entries,
}: {
  options: BoardOption[];
  selected: BoardOption | null;
  entries: BoardEntry[];
}) {
  const [level, setLevel] = useState<"all" | "1" | "2">("all");
  const [rx, setRx] = useState<"all" | "rx" | "scaled">("all");
  const [sex, setSex] = useState<"all" | "female" | "male">("all");
  const [age, setAge] = useState<string>("all");

  const ageGroups = useMemo(() => Array.from(new Set(entries.map((e) => e.age_group).filter(Boolean))) as string[], [entries]);
  const hasDemographics = entries.some((e) => e.sex || e.age_group);
  const hasLevels = entries.some((e) => e.level);

  const ranked = entries
    .filter(
      (e) =>
        (level === "all" || String(e.level) === level) &&
        (rx === "all" || (rx === "rx" ? e.rx : !e.rx)) &&
        (sex === "all" || e.sex === sex) &&
        (age === "all" || e.age_group === age),
    )
    .sort((a, b) => Number(b.rx) - Number(a.rx) || (b.level ?? 0) - (a.level ?? 0) || Number(b.score_value) - Number(a.score_value))
    .map((e, i) => ({ ...e, rank: i + 1, score: formatScore(e) }));

  const podium = ranked.length >= 3 ? [ranked[1], ranked[0], ranked[2]] : [];
  const rest = ranked.length >= 3 ? ranked.slice(3) : ranked;
  const heights: Record<number, number> = { 1: 112, 2: 88, 3: 72 };
  const href = (o: BoardOption) => (o.kind === "section" ? `/leaderboard?section=${o.id}` : `/leaderboard?benchmark=${encodeURIComponent(o.id)}`);

  return (
    <>
      <section className="flex flex-col gap-3.5">
        <div className="flex items-end justify-between">
          <div className="min-w-0">
            <Eyebrow className="truncate text-xs">{selected ? `${selected.when}${selected.scoring ? ` · ${scoringLabel(selected.scoring)}` : ""}` : "Club rankings"}</Eyebrow>
            <Display className="mt-0.5">Leaderboard</Display>
          </div>
          <span className="pb-1 text-[13px] text-mist">{ranked.length} athletes</span>
        </div>

        {options.length ? (
          <nav aria-label="Workouts" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {options.map((o) => {
              const on = selected?.kind === o.kind && selected.id === o.id;
              return (
                <Link
                  key={`${o.kind}:${o.id}`}
                  href={href(o)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "press flex h-[52px] flex-none flex-col justify-center rounded-button border px-3.5",
                    on ? "border-chalk bg-chalk text-matte" : "border-line bg-charcoal",
                  )}
                >
                  <span className="whitespace-nowrap text-sm font-bold">{o.name}</span>
                  <span className="whitespace-nowrap text-[11px] font-medium opacity-70">{o.when}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}

        {entries.length ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {hasLevels ? (
                <div className="flex-1">
                  <Segment
                    label="Level"
                    value={level}
                    onChange={setLevel}
                    options={[
                      { value: "all", label: "All" },
                      { value: "2", label: "L2" },
                      { value: "1", label: "L1" },
                    ]}
                  />
                </div>
              ) : null}
              <div className="flex-1">
                <Segment
                  label="Rx or scaled"
                  value={rx}
                  onChange={setRx}
                  options={[
                    { value: "all", label: "All" },
                    { value: "rx", label: "Rx" },
                    { value: "scaled", label: "Scaled" },
                  ]}
                />
              </div>
            </div>
            {hasDemographics ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Segment
                    label="Division"
                    value={sex}
                    onChange={setSex}
                    options={[
                      { value: "all", label: "All" },
                      { value: "female", label: "Women" },
                      { value: "male", label: "Men" },
                    ]}
                  />
                </div>
                {ageGroups.length > 1 ? (
                  <label className="sr-only" htmlFor="age-group">
                    Age group
                  </label>
                ) : null}
                {ageGroups.length > 1 ? (
                  <select
                    id="age-group"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="h-11 rounded-xl border border-line bg-charcoal px-3 text-[13px] font-bold text-chalk"
                  >
                    <option value="all">All ages</option>
                    {ageGroups.sort().map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {!selected ? (
        <EmptyState title="No leaderboards yet">Rankings appear once workouts are published and members log results.</EmptyState>
      ) : ranked.length === 0 ? (
        <EmptyState title={entries.length ? "No one in this division" : "No results yet"}>
          {entries.length ? "Try a different filter." : "Be the first to log a score."}
        </EmptyState>
      ) : (
        <>
          {podium.length ? (
            <section aria-label="Top three" className="grid grid-cols-3 items-end gap-2">
              {podium.map((p) => {
                const first = p.rank === 1;
                return (
                  <div key={p.result_id} className="flex flex-col items-center gap-2">
                    <div className={cn("rounded-full border-2", first ? "border-accent" : "border-hairline")}>
                      <Avatar name={p.display_name} size={first ? 56 : 46} tone={p.is_me ? "accent" : "neutral"} />
                    </div>
                    <div className="max-w-full truncate text-center text-[13px] font-semibold">
                      {p.display_name.split(" ")[0]} {p.display_name.split(" ")[1]?.[0] ? `${p.display_name.split(" ")[1][0]}.` : ""}
                    </div>
                    <div
                      className={cn(
                        "flex w-full flex-col items-center gap-0.5 rounded-[14px_14px_6px_6px] border pt-2.5",
                        first ? "border-accent bg-accent text-accent-ink" : "border-line bg-charcoal",
                      )}
                      style={{ height: heights[p.rank] }}
                    >
                      <div className={cn("font-display text-[26px] font-extrabold leading-none", first ? "" : "text-ash")}>{p.rank}</div>
                      <div className="font-display text-lg font-bold">{p.score}</div>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}

          {rest.length ? (
            <section aria-label="Rankings" className="rounded-card border border-line bg-charcoal px-3.5 py-1">
              <ol className="m-0 list-none p-0">
                {rest.map((r, i) => (
                  <li
                    key={r.result_id}
                    className={cn(
                      "-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5",
                      r.is_me ? "bg-accent/10" : i < rest.length - 1 && !rest[i + 1]?.is_me && "border-b border-line rounded-none",
                    )}
                  >
                    <span className={cn("w-6 text-center font-display text-xl font-bold", r.is_me ? "text-accent" : "text-ash")}>{r.rank}</span>
                    <Avatar name={r.display_name} size={36} tone={r.is_me ? "accent" : "neutral"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {r.display_name}
                        {r.is_me ? <span className="text-accent"> · You</span> : null}
                      </span>
                      <span className="text-xs text-mist">
                        {[levelLabel(r.level, r.rx), r.sex ? (r.sex === "female" ? "F" : "M") : null, r.age_group].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="font-display text-[22px] font-bold">{r.score}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}

      <p className="m-0 text-center text-xs leading-normal text-ash">
        Rx ranks above scaled, and Level 2 above Level 1. Only club members can see scores, and you can hide yours in{" "}
        <Link href="/account" className="text-fog underline">
          your account
        </Link>
        .
      </p>
    </>
  );
}
