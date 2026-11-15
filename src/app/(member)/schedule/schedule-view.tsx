"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { BirthdayCake, CheckIcon, ChevronLeftIcon, ChevronRightIcon, InfoIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Avatar, Display, EmptyState, Eyebrow, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DISCIPLINES, disciplineMeta } from "@/lib/scoring";
import type { Discipline, MemberScheduleRow, RsvpStatus } from "@/lib/supabase/database.types";
import { addDays, formatDateKey, formatTime, WEEKDAYS } from "@/lib/time";
import { getAttendees, setRsvp } from "./actions";

type Session = MemberScheduleRow & { day: string };

const RSVP_OPTIONS: Array<{ value: RsvpStatus; label: string }> = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Can't go" },
];

const FILTERS: Array<{ value: "all" | Discipline; label: string }> = [
  { value: "all", label: "All" },
  ...DISCIPLINES.map((d) => ({ value: d.value, label: d.label })),
];

export function ScheduleView({
  monday,
  today,
  initialDay,
  timeZone,
  sessions,
  nowIso,
}: {
  monday: string;
  today: string;
  initialDay: string;
  timeZone: string;
  sessions: Session[];
  nowIso: string;
}) {
  const router = useRouter();
  const [day, setDay] = useState(initialDay);
  const [filter, setFilter] = useState<"all" | Discipline>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Array<{ name: string; status: RsvpStatus; birthday: boolean }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Optimistic RSVP state layered over server data.
  const [local, setLocal] = useState<Record<string, RsvpStatus | null>>({});

  const now = new Date(nowIso).getTime();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const myStatus = (s: Session) => (s.id in local ? local[s.id] : s.my_status);
  const goingCount = (s: Session) => {
    const before = s.my_status === "going" ? 1 : 0;
    const after = myStatus(s) === "going" ? 1 : 0;
    return s.going_count - before + after;
  };

  const filtersInUse = useMemo(() => {
    const used = new Set(sessions.map((s) => s.discipline));
    return FILTERS.filter((f) => f.value === "all" || used.has(f.value));
  }, [sessions]);

  const visible = sessions.filter((s) => s.day === day && (filter === "all" || s.discipline === filter));
  const bookedThisWeek = sessions.filter((s) => myStatus(s) === "going" && s.status === "scheduled").length;
  const open = sessions.find((s) => s.id === openId) ?? null;

  function openSession(s: Session) {
    setOpenId(s.id);
    setMessage(null);
    setAttendees(null);
    getAttendees(s.id).then(setAttendees);
  }

  function choose(s: Session, status: RsvpStatus) {
    const previous = myStatus(s);
    setLocal((l) => ({ ...l, [s.id]: status }));
    setMessage(null);
    startTransition(async () => {
      const r = await setRsvp(s.id, status);
      if (!r.ok) {
        setLocal((l) => ({ ...l, [s.id]: previous }));
        setMessage(r.message);
        return;
      }
      getAttendees(s.id).then(setAttendees);
      router.refresh();
    });
  }

  const weekLabel = `${formatDateKey(monday, { month: "short", day: "numeric" })} – ${formatDateKey(addDays(monday, 6), {
    month: monday.slice(5, 7) === addDays(monday, 6).slice(5, 7) ? undefined : "short",
    day: "numeric",
  })}`;

  return (
    <>
      <section className="flex flex-col gap-3.5">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow className="text-xs">{weekLabel}</Eyebrow>
            <Display className="mt-0.5">Schedule</Display>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/schedule?week=${addDays(monday, -7)}`}
              aria-label="Previous week"
              className="press flex size-11 items-center justify-center rounded-full border border-hairline text-fog"
            >
              <ChevronLeftIcon size={18} />
            </Link>
            <Link
              href={`/schedule?week=${addDays(monday, 7)}`}
              aria-label="Next week"
              className="press flex size-11 items-center justify-center rounded-full border border-hairline"
            >
              <ChevronRightIcon size={18} />
            </Link>
          </div>
        </div>

        <div role="tablist" aria-label="Day" className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const sel = d === day;
            const hasBooking = sessions.some((s) => s.day === d && myStatus(s) === "going");
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={sel}
                aria-label={formatDateKey(d, { weekday: "long", month: "long", day: "numeric" })}
                onClick={() => setDay(d)}
                className={cn(
                  "press flex h-16 flex-col items-center justify-center gap-0.5 rounded-button border",
                  sel ? "border-chalk bg-chalk text-matte" : "border-line bg-charcoal",
                  !sel && d === today && "border-edge",
                )}
              >
                <span className="text-[11px] font-semibold tracking-[0.06em] opacity-80">{WEEKDAYS[i]}</span>
                <span className="font-display text-[22px] font-bold leading-none">{Number(d.slice(8))}</span>
                <span
                  className={cn("size-[5px] rounded-full", hasBooking ? (sel ? "bg-matte" : "bg-accent") : "bg-transparent")}
                />
              </button>
            );
          })}
        </div>

        {filtersInUse.length > 2 ? (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Filter classes">
            {filtersInUse.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "press h-9 flex-none rounded-full border px-3.5 text-[13px] font-semibold",
                  filter === f.value ? "border-accent bg-accent text-accent-ink" : "border-hairline text-fog",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2.5 border-t border-graphite pt-4">
        <div className="flex items-center justify-between px-0.5 pb-1">
          <h2 className="m-0 text-[15px] font-bold">
            {formatDateKey(day, { weekday: "long" })}
            {day === today ? " · Today" : ""}
          </h2>
          <span className="text-[13px] text-mist">
            {bookedThisWeek} {bookedThisWeek === 1 ? "class" : "classes"} booked this week
          </span>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No classes">
            {sessions.length === 0 ? "Nothing is scheduled this week yet." : "Nothing on this day. Try another day."}
          </EmptyState>
        ) : (
          visible.map((s) => {
            const t = formatTime(s.starts_at, timeZone);
            const meta = disciplineMeta(s.discipline);
            const going = goingCount(s);
            const full = going >= s.capacity;
            const mine = myStatus(s);
            const past = new Date(s.starts_at).getTime() + s.duration_min * 60000 < now;
            const cancelled = s.status === "cancelled";
            return (
              <article
                key={s.id}
                className={cn(
                  "flex items-center gap-3.5 rounded-card border bg-charcoal p-3.5",
                  mine === "going" ? "border-accent/45" : "border-line",
                  (past || cancelled) && "opacity-60",
                )}
              >
                <button
                  type="button"
                  onClick={() => openSession(s)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                  aria-label={`${s.title} at ${t.label}, details`}
                >
                  <span className="w-[54px] flex-none text-center">
                    <span className="block font-display text-[26px] font-extrabold leading-none">{t.time}</span>
                    <span className="mt-0.5 block text-[10px] font-bold tracking-[0.12em] text-ash">{t.ampm}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                        {cancelled ? "Cancelled" : meta.label}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-[15px] font-bold">
                      {s.title}
                      {s.birthday_count > 0 ? <BirthdayCake size={15} /> : null}
                    </span>
                    <ProgressBar value={going} max={s.capacity} tone={full && mine !== "going" ? "warn" : "accent"} />
                    <span className="text-xs text-mist">
                      {full ? `Full · ${s.capacity}/${s.capacity}` : `${going}/${s.capacity}`}
                      {s.coach_label ? ` · ${s.coach_label}` : ""} · {s.duration_min} min
                    </span>
                  </span>
                </button>
                <div className="flex-none">
                  {cancelled || past ? null : mine === "going" ? (
                    <Button variant="soft" size="pill" onClick={() => openSession(s)} aria-label="You're going. Change RSVP">
                      <CheckIcon size={15} /> Going
                    </Button>
                  ) : mine === "maybe" ? (
                    <Button variant="secondary" size="pill" className="rounded-full" onClick={() => openSession(s)}>
                      Maybe
                    </Button>
                  ) : full ? (
                    <Button variant="secondary" size="pill" className="rounded-full bg-transparent text-fog" onClick={() => openSession(s)}>
                      Full
                    </Button>
                  ) : (
                    <Button variant="inverse" size="pill" disabled={pending} onClick={() => choose(s, "going")}>
                      RSVP
                    </Button>
                  )}
                </div>
              </article>
            );
          })
        )}

        <p className="m-0 flex items-start gap-2.5 px-1 pt-2.5 text-xs leading-normal text-ash">
          <InfoIcon size={16} className="mt-px flex-none" />
          Tap a class to see who&apos;s going. If plans change, switch to Can&apos;t go so someone else can take your spot.
        </p>
      </section>

      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} label="Class details">
        {open ? (
          <>
            <div>
              <Eyebrow>
                {formatDateKey(open.day, { weekday: "long", month: "short", day: "numeric" })} ·{" "}
                {formatTime(open.starts_at, timeZone).label}
              </Eyebrow>
              <Display as="h2" className="mt-1 text-[34px]">
                {open.title}
              </Display>
              <div className="mt-1 text-[13px] text-mist">
                {disciplineMeta(open.discipline).label}
                {open.coach_label ? ` · ${open.coach_label}` : ""} · {open.duration_min} min · {goingCount(open)}/{open.capacity} going
              </div>
            </div>

            {open.status === "cancelled" ? (
              <p className="m-0 rounded-button bg-conditioning/14 px-4 py-3 text-sm text-conditioning">This class was cancelled.</p>
            ) : new Date(open.starts_at).getTime() + open.duration_min * 60000 < now ? (
              <p className="m-0 text-sm text-mist">This class has finished.</p>
            ) : (
              <div role="radiogroup" aria-label="Your RSVP" className="grid grid-cols-3 gap-2">
                {RSVP_OPTIONS.map((o) => {
                  const on = myStatus(open) === o.value;
                  const blocked = o.value === "going" && !on && goingCount(open) >= open.capacity;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={pending || blocked}
                      onClick={() => choose(open, o.value)}
                      className={cn(
                        "press h-14 rounded-button border text-sm font-bold disabled:opacity-40",
                        on
                          ? o.value === "going"
                            ? "border-accent bg-accent text-accent-ink"
                            : "border-chalk bg-chalk text-matte"
                          : "border-hairline bg-matte text-fog",
                      )}
                    >
                      {o.value === "going" && blocked ? "Full" : o.label}
                    </button>
                  );
                })}
              </div>
            )}

            {message ? (
              <p role="alert" className="m-0 text-sm font-medium text-conditioning">
                {message}
              </p>
            ) : null}

            {open.workout_id ? (
              <Link
                href={`/workouts/${open.workout_id}`}
                className="press flex items-center justify-between rounded-button border border-hairline bg-matte px-4 py-3"
              >
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-eyebrow text-ash">Workout</span>
                  <span className="text-[15px] font-bold">{open.workout_title}</span>
                </span>
                <ChevronRightIcon size={18} />
              </Link>
            ) : null}

            <div className="flex flex-col gap-2">
              <Eyebrow>Who&apos;s coming</Eyebrow>
              {attendees === null ? (
                <div className="h-10 animate-pulse rounded-xl bg-graphite" />
              ) : attendees.length === 0 ? (
                <p className="m-0 text-sm text-mist">No one yet. Be the first.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {attendees.map((a, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      <Avatar name={a.name} size={30} />
                      <span className="flex flex-1 items-center gap-1.5 font-semibold">
                        {a.name}
                        {a.birthday ? <BirthdayCake name={a.name} /> : null}
                      </span>
                      <span className={cn("text-xs font-semibold", a.status === "going" ? "text-accent" : "text-mist")}>
                        {a.status === "going" ? "Going" : "Maybe"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
