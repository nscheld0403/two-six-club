"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { Badge, Card, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DISCIPLINES, disciplineMeta } from "@/lib/scoring";
import type { Discipline, SeriesRow, SessionKind, SessionRow } from "@/lib/supabase/database.types";
import { addDays, formatDateKey, WEEKDAYS } from "@/lib/time";
import {
  deleteSession,
  duplicateWeek,
  extendSeries,
  publishWeek,
  saveSession,
  saveSettings,
  setSessionStatus,
  stopSeries,
  type ActionResult,
  type SessionInput,
} from "./actions";

type Session = SessionRow & { date: string; time: string; going: number; maybe: number };
type Draft = {
  id: string | null;
  title: string;
  kind: SessionKind;
  discipline: Discipline;
  date: string;
  time: string;
  durationMin: number;
  capacity: number;
  coachLabel: string;
  workoutId: string;
  notes: string;
  published: boolean;
  repeatWeekly: boolean;
  repeatUntil: string;
  status: "scheduled" | "cancelled";
};

const input = cn(inputClasses, "h-12 bg-matte text-[15px]");
const labelCls = "flex flex-col gap-1.5 text-xs font-semibold text-mist";

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function ScheduleManager({
  monday,
  today,
  timeZone,
  defaultCapacity,
  sessions,
  workouts,
  series,
}: {
  monday: string;
  today: string;
  timeZone: string;
  defaultCapacity: number;
  sessions: Session[];
  workouts: Array<{ id: string; title: string; workout_date: string | null; status: string }>;
  series: SeriesRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copyWorkouts, setCopyWorkouts] = useState(true);
  const [settings, setSettings] = useState({ timezone: timeZone, defaultCapacity });
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const unpublished = sessions.filter((s) => !s.published).length;

  function run(fn: () => Promise<ActionResult>, after?: () => void) {
    start(async () => {
      const r = await fn();
      setNotice({ ok: r.ok, text: r.message ?? (r.ok ? "Done." : "Something went wrong.") });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  function newDraft(date: string, kind: SessionKind = "class"): Draft {
    return {
      id: null,
      title: kind === "open_gym" ? "Open Gym" : "CrossFit",
      kind,
      discipline: kind === "open_gym" ? "open_gym" : "crossfit",
      date,
      time: kind === "open_gym" ? "09:00" : "06:00",
      durationMin: kind === "open_gym" ? 120 : 60,
      capacity: defaultCapacity,
      coachLabel: "",
      workoutId: workouts.find((w) => w.workout_date === date)?.id ?? "",
      notes: "",
      published: true,
      repeatWeekly: false,
      repeatUntil: "",
      status: "scheduled",
    };
  }

  function edit(s: Session) {
    setDraft({
      id: s.id,
      title: s.title,
      kind: s.kind,
      discipline: s.discipline,
      date: s.date,
      time: s.time,
      durationMin: s.duration_min,
      capacity: s.capacity,
      coachLabel: s.coach_label ?? "",
      workoutId: s.workout_id ?? "",
      notes: s.notes ?? "",
      published: s.published,
      repeatWeekly: false,
      repeatUntil: "",
      status: s.status,
    });
  }

  function submitDraft() {
    if (!draft) return;
    const payload: SessionInput = {
      id: draft.id,
      title: draft.title,
      kind: draft.kind,
      discipline: draft.discipline,
      date: draft.date,
      time: draft.time,
      durationMin: draft.durationMin,
      capacity: draft.capacity,
      coachLabel: draft.coachLabel || null,
      workoutId: draft.workoutId || null,
      notes: draft.notes || null,
      published: draft.published,
      repeatWeekly: draft.repeatWeekly,
      repeatUntil: draft.repeatUntil || null,
    };
    run(() => saveSession(payload), () => setDraft(null));
  }

  const editing = draft?.id ? sessions.find((s) => s.id === draft.id) : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="text-xs">
            {formatDateKey(monday, { month: "long", day: "numeric" })} – {formatDateKey(addDays(monday, 6), { month: "long", day: "numeric" })}
          </Eyebrow>
          <Display className="mt-1 text-[48px]">Class schedule</Display>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/schedule?week=${addDays(monday, -7)}`} aria-label="Previous week" className="press flex size-11 items-center justify-center rounded-full border border-hairline">
            <ChevronLeftIcon size={18} />
          </Link>
          <Link href={`/admin/schedule?week=${addDays(monday, 7)}`} aria-label="Next week" className="press flex size-11 items-center justify-center rounded-full border border-hairline">
            <ChevronRightIcon size={18} />
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setDraft(newDraft(days.includes(today) ? today : monday, "open_gym"))}>
            Add open gym
          </Button>
          <Button size="sm" onClick={() => setDraft(newDraft(days.includes(today) ? today : monday))}>
            <PlusIcon size={16} /> Add class
          </Button>
        </div>
      </header>

      {notice ? (
        <div role="status" className={cn("flex items-center gap-3 rounded-button border px-4 py-3 text-sm", notice.ok ? "border-accent/40 bg-accent/12" : "border-conditioning/40 bg-conditioning/12 text-conditioning")}>
          <span className="flex-1">{notice.text}</span>
          <button type="button" aria-label="Dismiss" className="text-lg text-mist" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      ) : null}

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1 text-sm text-fog">
          {sessions.length === 0
            ? "This week is empty."
            : unpublished
              ? `${unpublished} of ${sessions.length} sessions are hidden from members.`
              : `All ${sessions.length} sessions are visible to members.`}
        </div>
        {unpublished ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => publishWeek(monday))}>
            Publish week
          </Button>
        ) : null}
        <label className="flex items-center gap-2 text-[13px] text-mist">
          <input type="checkbox" checked={copyWorkouts} onChange={(e) => setCopyWorkouts(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          include workouts
        </label>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Copy last week's one-off sessions${copyWorkouts ? " and workouts" : ""} into this week?`)) run(() => duplicateWeek(addDays(monday, -7), monday, copyWorkouts));
          }}
        >
          Copy last week here
        </Button>
      </Card>

      <div className="overflow-x-auto rounded-card border border-line bg-charcoal p-4">
        <div className="grid min-w-[900px] grid-cols-7 gap-2">
          {days.map((d, i) => {
            const list = sessions.filter((s) => s.date === d);
            return (
              <div key={d} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between border-b border-line px-1 pb-1.5">
                  <span className={cn("text-xs font-bold tracking-[0.08em]", d === today ? "text-accent" : "text-ash")}>{WEEKDAYS[i].toUpperCase()}</span>
                  <span className={cn("font-display text-xl font-bold", d === today && "text-accent")}>{Number(d.slice(8))}</span>
                </div>
                {list.map((s) => {
                  const meta = disciplineMeta(s.discipline);
                  const full = s.going >= s.capacity;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => edit(s)}
                      className={cn(
                        "press flex flex-col gap-1 rounded-xl border bg-matte p-2.5 text-left hover:border-edge",
                        s.status === "cancelled" ? "border-line opacity-50" : !s.published ? "border-dashed border-edge" : full ? "border-conditioning/45" : "border-line",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
                        <span className="font-display text-[17px] font-bold">{fmt12(s.time)}</span>
                      </span>
                      <span className="text-xs font-semibold leading-tight">{s.title}</span>
                      <span className="text-[11px] text-mist">
                        {s.going}/{s.capacity}
                        {s.maybe ? ` · ${s.maybe} maybe` : ""}
                        {s.status === "cancelled" ? " · cancelled" : !s.published ? " · hidden" : ""}
                        {s.series_id ? " · ↻" : ""}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setDraft(newDraft(d))}
                  aria-label={`Add session on ${formatDateKey(d, { weekday: "long" })}`}
                  className="press flex h-9 items-center justify-center rounded-xl border border-dashed border-hairline text-ash hover:text-fog"
                >
                  <PlusIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[3_1_420px] flex-col gap-3 p-5">
          <Display as="h2" size="h2" className="text-2xl">
            Repeating sessions
          </Display>
          {series.length === 0 ? (
            <EmptyState title="Nothing repeats yet">When adding a class, tick &ldquo;Repeat every week&rdquo; to schedule it ahead.</EmptyState>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
              {series.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.title}</span>
                    <span className="text-xs text-mist">
                      Every {WEEKDAYS[s.weekday - 1]} · {fmt12(s.start_time.slice(0, 5))} · {s.capacity} spots{s.ends_on ? ` · until ${s.ends_on}` : ""}
                    </span>
                  </span>
                  <Button variant="secondary" size="sm" className="h-9 rounded-[10px]" disabled={pending} onClick={() => run(() => extendSeries(s.id, 8))}>
                    Extend 8 weeks
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="h-9 rounded-[10px]"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Stop repeating "${s.title}"? Future sessions without RSVPs are removed.`)) run(() => stopSeries(s.id));
                    }}
                  >
                    Stop
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex min-w-0 flex-[2_1_280px] flex-col gap-3 p-5">
          <Display as="h2" size="h2" className="text-2xl">
            Settings
          </Display>
          <label className={labelCls}>
            Default class capacity
            <input inputMode="numeric" value={settings.defaultCapacity} onChange={(e) => setSettings((x) => ({ ...x, defaultCapacity: Number(e.target.value.replace(/\D/g, "")) || 0 }))} className={input} />
          </label>
          <label className={labelCls}>
            Gym time zone
            <input value={settings.timezone} onChange={(e) => setSettings((x) => ({ ...x, timezone: e.target.value }))} placeholder="America/New_York" className={input} />
          </label>
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => saveSettings(settings))}>
            Save settings
          </Button>
        </Card>
      </div>

      <Sheet open={Boolean(draft)} onClose={() => setDraft(null)} label={draft?.id ? "Edit session" : "Add session"}>
        {draft ? (
          <div className="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto">
            <Display as="h2" className="text-[30px]">
              {draft.id ? "Edit session" : draft.kind === "open_gym" ? "Add open gym" : "Add class"}
            </Display>
            {editing ? (
              <Link href={`/admin/schedule/${editing.id}`} className="press flex items-center justify-between rounded-button border border-hairline bg-matte px-4 py-3 text-sm">
                <span>
                  Roster &amp; attendance · <strong>{editing.going}</strong> going{editing.maybe ? `, ${editing.maybe} maybe` : ""}
                </span>
                <ChevronRightIcon size={16} />
              </Link>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className={cn(labelCls, "col-span-2")}>
                Name
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={60} className={input} />
              </label>
              <label className={labelCls}>
                Kind
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as SessionKind, discipline: e.target.value === "open_gym" ? "open_gym" : draft.discipline === "open_gym" ? "crossfit" : draft.discipline })} className={input}>
                  <option value="class">Class</option>
                  <option value="open_gym">Open gym</option>
                </select>
              </label>
              <label className={labelCls}>
                Type
                <select value={draft.discipline} disabled={draft.kind === "open_gym"} onChange={(e) => setDraft({ ...draft, discipline: e.target.value as Discipline })} className={input}>
                  {DISCIPLINES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                Date
                <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={cn(input, "[color-scheme:dark]")} />
              </label>
              <label className={labelCls}>
                Start time
                <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className={cn(input, "[color-scheme:dark]")} />
              </label>
              <label className={labelCls}>
                Minutes
                <input inputMode="numeric" value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={input} />
              </label>
              <label className={labelCls}>
                Capacity
                <input inputMode="numeric" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={input} />
              </label>
              <label className={labelCls}>
                Coach (optional)
                <input value={draft.coachLabel} onChange={(e) => setDraft({ ...draft, coachLabel: e.target.value })} maxLength={40} placeholder="Coach name" className={input} />
              </label>
              <label className={labelCls}>
                Workout
                <select value={draft.workoutId} onChange={(e) => setDraft({ ...draft, workoutId: e.target.value })} className={input}>
                  <option value="">None</option>
                  {workouts
                    .filter((w) => w.workout_date === draft.date)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                        {w.status === "draft" ? " (draft)" : ""}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {!draft.id ? (
              <label className="flex items-center gap-3 text-sm text-fog">
                <input type="checkbox" checked={draft.repeatWeekly} onChange={(e) => setDraft({ ...draft, repeatWeekly: e.target.checked })} className="size-5 accent-[var(--color-accent)]" />
                Repeat every {formatDateKey(draft.date, { weekday: "long" })}
              </label>
            ) : null}
            {draft.repeatWeekly ? (
              <label className={labelCls}>
                Until (optional; leave empty for 12 weeks ahead)
                <input type="date" value={draft.repeatUntil} onChange={(e) => setDraft({ ...draft, repeatUntil: e.target.value })} className={cn(input, "[color-scheme:dark]")} />
              </label>
            ) : (
              <label className="flex items-center gap-3 text-sm text-fog">
                <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} className="size-5 accent-[var(--color-accent)]" />
                Visible to members
              </label>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button className="flex-1" disabled={pending} onClick={submitDraft}>
                {pending ? "Saving…" : draft.id ? "Save changes" : draft.repeatWeekly ? "Create repeating" : "Add session"}
              </Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Close
              </Button>
            </div>
            {draft.id ? (
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                {draft.status === "scheduled" ? (
                  <Button variant="danger" size="sm" className="flex-1" disabled={pending} onClick={() => run(() => setSessionStatus(draft.id!, "cancelled"), () => setDraft(null))}>
                    Cancel session
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="flex-1" disabled={pending} onClick={() => run(() => setSessionStatus(draft.id!, "scheduled"), () => setDraft(null))}>
                    Restore session
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Delete this session?")) run(() => deleteSession(draft.id!), () => setDraft(null));
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : null}
            {editing?.status === "cancelled" ? <Badge tone="warn">Cancelled</Badge> : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
