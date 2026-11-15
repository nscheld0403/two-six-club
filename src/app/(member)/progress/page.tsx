import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge, Card, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { benchmarkProgress, monthlyActivity, weekStreak, weeklyActivity, weeklyVolume, type ActivityEvent } from "@/lib/analytics";
import { requireActiveMember } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { formatDuration, formatPace, formatScore, levelLabel } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import { addDays, dateKeyIn, formatDateKey, todayKey } from "@/lib/time";
import { ActivityChart, StrengthChart, VolumeChart, type StrengthSeries } from "./charts";

export const metadata = { title: "My Progress" };

const nowMs = () => Date.now();

export default async function ProgressPage() {
  const me = await requireActiveMember();
  const { timeZone } = await getClubSettings();
  const today = todayKey(timeZone);
  const supabase = await createClient();

  const [{ data: results }, { data: liftBests }, { data: e1rm }, { data: reservations }] = await Promise.all([
    supabase.from("results").select("*").eq("member_id", me.id).order("performed_on", { ascending: false }),
    supabase.from("lift_bests").select("*").eq("member_id", me.id),
    supabase.from("e1rm_daily").select("*").eq("member_id", me.id).order("performed_on"),
    supabase.from("reservations").select("session_id, status, attended").eq("member_id", me.id).neq("status", "not_going"),
  ]);

  // Attendance: a class counts when the coach marked it, or when you were
  // "going" and the coach didn't record otherwise.
  const sessionIds = (reservations ?? []).map((r) => r.session_id);
  const { data: sessions } = sessionIds.length
    ? await supabase.from("class_sessions").select("id, starts_at, duration_min").in("id", sessionIds)
    : { data: [] };
  const now = nowMs();
  const attendedDates = (reservations ?? [])
    .map((r) => ({ r, s: sessions?.find((x) => x.id === r.session_id) }))
    .filter(({ r, s }) => s && new Date(s.starts_at).getTime() + s.duration_min * 60000 < now && (r.attended === true || (r.attended === null && r.status === "going")))
    .map(({ s }) => dateKeyIn(new Date(s!.starts_at), timeZone));

  const all = results ?? [];
  const events: ActivityEvent[] = [
    ...all.map((r) => ({ date: r.performed_on, kind: "result" as const })),
    ...attendedDates.map((d) => ({ date: d, kind: "class" as const })),
  ];
  const weekly = weeklyActivity(events, today, 12);
  const monthly = monthlyActivity(events, today, 12);
  const streak = weekStreak(events, today);
  const yearPrefix = today.slice(0, 4);

  // Strength: estimated 1RM per movement (most-logged first).
  const byMovement = new Map<string, StrengthSeries>();
  for (const row of e1rm ?? []) {
    if (!byMovement.has(row.movement_id)) byMovement.set(row.movement_id, { movementId: row.movement_id, name: row.movement_name, points: [] });
    byMovement.get(row.movement_id)!.points.push({
      date: row.performed_on,
      label: formatDateKey(row.performed_on, { month: "short", day: "numeric" }),
      e1rm: Number(row.e1rm_lbs),
    });
  }
  const strength = Array.from(byMovement.values()).sort((a, b) => b.points.length - a.points.length);
  const volume = weeklyVolume((e1rm ?? []).map((r) => ({ performed_on: r.performed_on, volume_lbs: Number(r.volume_lbs) })), today, 12);
  const hasVolume = volume.some((v) => v.volume > 0);

  // Personal records: best 1/3/5RM per lift, then benchmark bests.
  const lifts = new Map<string, { name: string; best: Record<number, { load: number; date: string }>; latest: string }>();
  for (const b of liftBests ?? []) {
    if (![1, 2, 3, 5].includes(b.reps)) continue;
    if (!lifts.has(b.movement_id)) lifts.set(b.movement_id, { name: b.movement_name, best: {}, latest: b.performed_on });
    const l = lifts.get(b.movement_id)!;
    l.best[b.reps] = { load: Number(b.load_lbs), date: b.performed_on };
    if (b.performed_on > l.latest) l.latest = b.performed_on;
  }
  const liftPrs = Array.from(lifts.values()).sort((a, b) => b.latest.localeCompare(a.latest));
  const benchmarks = benchmarkProgress(all);
  const monthAgo = addDays(today, -30);
  const prsThisYear = liftPrs.filter((l) => l.latest.startsWith(yearPrefix)).length + benchmarks.filter((b) => b.best.performed_on.startsWith(yearPrefix)).length;

  // Conditioning: fixed-distance efforts with pace.
  const trials = all.filter((r) => r.scoring === "time_trial" && r.time_seconds && r.distance_m);
  const trialGroups = new Map<string, typeof trials>();
  for (const t of trials) {
    const k = `${t.title}|${t.distance_m}`;
    if (!trialGroups.has(k)) trialGroups.set(k, []);
    trialGroups.get(k)!.push(t);
  }
  const conditioning = Array.from(trialGroups.values()).map((list) => {
    const best = list.reduce((b, r) => (r.time_seconds! < b.time_seconds! ? r : b), list[0]);
    const oldest = list[list.length - 1];
    return { title: best.title, distance: Number(best.distance_m), best, attempts: list.length, gain: oldest.time_seconds! - best.time_seconds! };
  });

  const since = new Date(me.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const empty = all.length === 0 && attendedDates.length === 0;

  return (
    <>
      <header className="flex items-center gap-3.5">
        <Avatar name={me.display_name} size={60} tone="accent" />
        <div className="min-w-0 flex-1">
          <Display className="text-[32px] leading-none">My Progress</Display>
          <div className="mt-1 truncate text-[13px] text-mist">
            {me.display_name} · Member since {since}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2">
        {[
          { v: attendedDates.length, l: "Classes" },
          { v: streak, l: "Week streak", u: streak ? " wk" : "" },
          { v: prsThisYear, l: `PRs in ${yearPrefix}` },
        ].map((s) => (
          <Card key={s.l} className="p-3">
            <div className="font-display text-[28px] font-bold leading-none">
              {s.v}
              {s.u ? <span className="text-base text-ash">{s.u}</span> : null}
            </div>
            <div className="mt-1 text-[11px] text-mist">{s.l}</div>
          </Card>
        ))}
      </section>

      {empty ? (
        <EmptyState title="Your story starts here" action={<ButtonLink href="/log" size="sm">Log your first result</ButtonLink>}>
          Come to class and log results. Records, trends and charts build up automatically.
        </EmptyState>
      ) : null}

      {strength.length ? (
        <Card hero>
          <StrengthChart series={strength} />
        </Card>
      ) : null}

      {liftPrs.length || benchmarks.length ? (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-0.5">
            <Display as="h2" size="h2">
              Personal records
            </Display>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {liftPrs.map((l) => {
              const top = l.best[1] ?? l.best[3] ?? l.best[5] ?? l.best[2];
              const reps = l.best[1] ? 1 : l.best[3] ? 3 : l.best[5] ? 5 : 2;
              const isNew = top.date >= monthAgo;
              return (
                <Card key={l.name} className={isNew ? "border-accent/40 p-3.5" : "p-3.5"}>
                  <div className="flex items-center justify-between gap-2">
                    <Eyebrow className="truncate">{l.name}</Eyebrow>
                    {isNew ? <Badge tone="accent" className="h-5 px-1.5 text-[10px]">New</Badge> : null}
                  </div>
                  <div className="font-display text-[34px] font-bold leading-tight">
                    {top.load}
                    <span className="text-base text-ash"> lb</span>
                  </div>
                  <div className="text-xs text-mist">
                    {reps}RM · {formatDateKey(top.date, { month: "short", day: "numeric" })}
                    {[1, 3, 5].filter((r) => r !== reps && l.best[r]).map((r) => ` · ${r}RM ${l.best[r].load}`).join("")}
                  </div>
                </Card>
              );
            })}
            {benchmarks.map((b) => (
              <Card key={`${b.name}${b.rx}`} className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow className="truncate">{b.name}</Eyebrow>
                  <Badge tone={b.rx ? "inverse" : "neutral"} className="h-5 px-1.5 text-[10px]">
                    {b.rx ? "Rx" : "Scaled"}
                  </Badge>
                </div>
                <div className="font-display text-[34px] font-bold leading-tight">{formatScore(b.best)}</div>
                <div className="text-xs text-mist">
                  {b.attempts > 1
                    ? b.improved
                      ? `Up from ${formatScore(b.first)} · ${b.attempts} tries`
                      : `${b.attempts} tries`
                    : formatDateKey(b.best.performed_on, { month: "short", day: "numeric" })}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {conditioning.length ? (
        <section className="flex flex-col gap-2.5">
          <Display as="h2" size="h2" className="px-0.5">
            Conditioning
          </Display>
          <Card className="py-1">
            {conditioning.map((c) => (
              <div key={`${c.title}${c.distance}`} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.title}</div>
                  <div className="text-xs text-mist">
                    {formatPace(c.best.time_seconds!, c.distance, c.distance >= 3000 ? 1000 : 500)}
                    {c.attempts > 1 && c.gain > 0 ? ` · ${formatDuration(c.gain)} faster than your first` : ""}
                  </div>
                </div>
                <div className="font-display text-xl font-bold">{formatDuration(c.best.time_seconds!)}</div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {!empty ? (
        <Card hero className="flex flex-col gap-6">
          <ActivityChart weekly={weekly} monthly={monthly} />
          {hasVolume ? <VolumeChart data={volume} /> : null}
        </Card>
      ) : null}

      {all.length ? (
        <section className="flex flex-col gap-2.5">
          <Display as="h2" size="h2" className="px-0.5">
            History
          </Display>
          <Card className="py-1">
            {all.slice(0, 25).map((r) => (
              <Link
                key={r.id}
                href={r.section_id ? `/log/${r.section_id}` : `/log/new?edit=${r.id}`}
                className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
              >
                <div className="w-[42px] flex-none text-center">
                  <div className="text-[10px] font-bold tracking-[0.1em] text-ash">
                    {formatDateKey(r.performed_on, { weekday: "short" }).toUpperCase()}
                  </div>
                  <div className="font-display text-[22px] font-bold leading-none">{Number(r.performed_on.slice(8))}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.title}</div>
                  <div className="truncate text-xs text-mist">
                    {[formatDateKey(r.performed_on, { month: "short", year: r.performed_on.startsWith(yearPrefix) ? undefined : "numeric" }), levelLabel(r.level, r.rx), r.rpe ? `RPE ${r.rpe}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="font-display text-xl font-bold">{formatScore(r)}</div>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
