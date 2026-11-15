import Link from "next/link";
import { ArrowRightIcon, CakeIcon, CalendarIcon, PlusIcon, RanksIcon, TrendIcon } from "@/components/icons";
import { isBirthdayOn } from "@/lib/birthday";
import { ButtonLink } from "@/components/ui/button";
import { Card, Display, EmptyState, Eyebrow, ProgressBar } from "@/components/ui/primitives";
import { requireActiveMember } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { disciplineMeta, scoringShort } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import { addDays, dateKeyIn, formatDateKey, formatTime, todayKey, zonedParts, zonedToUtc } from "@/lib/time";
import { loadWorkouts } from "@/lib/workouts";
import { NextClassRsvp } from "./next-class-rsvp";

export const metadata = { title: "Home" };

const now = () => new Date();

export default async function HomePage() {
  const me = await requireActiveMember();
  const { timeZone } = await getClubSettings();
  const current = now();
  const today = todayKey(timeZone, current);
  const hour = zonedParts(current, timeZone).hour;
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const supabase = await createClient();

  const [[todayWorkout], { data: upcoming }, { data: recent }, { data: myRes }] = await Promise.all([
    loadWorkouts({ dates: [today] }),
    supabase.rpc("member_schedule", {
      p_from: current.toISOString(),
      p_to: zonedToUtc(addDays(today, 8), "00:00", timeZone).toISOString(),
    }),
    supabase.from("results").select("performed_on").eq("member_id", me.id).gte("performed_on", addDays(today, -6)),
    supabase.from("reservations").select("session_id, status, attended").eq("member_id", me.id).eq("status", "going"),
  ]);

  const open = (upcoming ?? []).filter((s) => s.status === "scheduled");
  const nextClass = open.find((s) => s.my_status === "going") ?? open[0] ?? null;

  // Last 7 days: a day counts if you logged a result or were booked into a class.
  const sessionIds = (myRes ?? []).map((r) => r.session_id);
  const { data: past } = sessionIds.length
    ? await supabase
        .from("class_sessions")
        .select("id, starts_at")
        .in("id", sessionIds)
        .gte("starts_at", zonedToUtc(addDays(today, -6), "00:00", timeZone).toISOString())
        .lte("starts_at", current.toISOString())
    : { data: [] };
  const trained = new Set<string>([
    ...(recent ?? []).map((r) => r.performed_on),
    ...(past ?? [])
      .filter((s) => (myRes ?? []).find((r) => r.session_id === s.id)?.attended !== false)
      .map((s) => dateKeyIn(new Date(s.starts_at), timeZone)),
  ]);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const sessionsThisWeek = week.filter((d) => trained.has(d)).length;

  const actions = [
    { href: "/schedule", title: "Book a class", sub: open.length ? `${open.length} coming up` : "See the week", Icon: CalendarIcon },
    { href: "/log", title: "Log result", sub: todayWorkout ? `${todayWorkout.title}` : "Record a workout", Icon: PlusIcon },
    { href: "/leaderboard", title: "Leaderboard", sub: "Club rankings", Icon: RanksIcon },
    { href: "/progress", title: "My PRs", sub: "Records & trends", Icon: TrendIcon },
  ];

  const meta = todayWorkout ? disciplineMeta(todayWorkout.discipline) : null;
  const scored = todayWorkout?.sections.filter((s) => s.scoring !== "none") ?? [];

  return (
    <>
      <section className="flex flex-col gap-1 pt-1">
        <Eyebrow className="text-xs">{formatDateKey(today, { weekday: "long", month: "long", day: "numeric" })}</Eyebrow>
        {isBirthdayOn(me.birth_date, today) ? (
          <Display className="flex items-center gap-3 text-[32px]">
            Happy birthday, {me.display_name.split(" ")[0]}.
            <CakeIcon size={36} className="flex-none text-strength" />
          </Display>
        ) : (
          <Display className="text-[32px]">
            {greeting}, {me.display_name.split(" ")[0]}.
          </Display>
        )}
      </section>

      {!me.birth_date ? (
        <Link
          href="/account"
          className="press flex items-center gap-3 rounded-card border border-strength/40 bg-charcoal px-4 py-3"
        >
          <CakeIcon size={22} className="flex-none text-strength" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Add your birthday</span>
            <span className="block text-xs text-mist">So the club can celebrate you. Only the coach sees the date.</span>
          </span>
          <ArrowRightIcon size={16} className="flex-none text-mist" />
        </Link>
      ) : null}

      <Card aria-label="Last 7 days" className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <Eyebrow>Last 7 days</Eyebrow>
          <div className="font-display text-[26px] font-bold leading-none">
            {sessionsThisWeek}
            <span className="text-ash"> {sessionsThisWeek === 1 ? "session" : "sessions"}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {week.map((d) => {
            const on = trained.has(d);
            const isToday = d === today;
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <div
                  className={on ? "size-[22px] rounded-full border-[1.5px] border-accent bg-accent" : "size-[22px] rounded-full border-[1.5px]"}
                  style={on ? undefined : { borderColor: isToday ? "var(--color-chalk)" : "#343638" }}
                  aria-label={`${formatDateKey(d, { weekday: "long" })}: ${on ? "trained" : "rest"}`}
                />
                <div className={isToday ? "text-[10px] font-semibold text-chalk" : "text-[10px] font-semibold text-ash"}>
                  {formatDateKey(d, { weekday: "narrow" })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <section aria-label="Today's workout">
        {todayWorkout && meta ? (
          <Card hero className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 p-[18px] pb-4">
              <div className="flex items-center justify-between">
                <span className="flex h-6 items-center rounded-full bg-accent px-2.5 text-[11px] font-bold tracking-[0.1em] text-accent-ink">
                  TODAY&apos;S WOD
                </span>
                <span className="text-xs text-mist">{meta.label}</span>
              </div>
              <h2 className="m-0 font-brand text-[38px] font-bold uppercase leading-none">{todayWorkout.title}</h2>
              {todayWorkout.summary ? <div className="text-sm text-fog">{todayWorkout.summary}</div> : null}
              {todayWorkout.sections.length ? (
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {todayWorkout.sections.slice(0, 3).map((s) => (
                    <div key={s.id} className="min-w-0 rounded-xl bg-graphite px-3 py-2.5">
                      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ash">{s.kind}</div>
                      <div className="truncate font-display text-lg font-bold">
                        {s.time_cap_seconds ? `${Math.round(s.time_cap_seconds / 60)}'` : s.scoring !== "none" ? scoringShort(s.scoring) : s.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2 px-[18px] pb-[18px]">
              <ButtonLink href={`/workouts/${todayWorkout.id}`} className="flex-1">
                View workout <ArrowRightIcon size={16} />
              </ButtonLink>
              {scored.length ? (
                <ButtonLink href={`/log/${scored[0].id}`} variant="secondary">
                  Log result
                </ButtonLink>
              ) : null}
            </div>
          </Card>
        ) : (
          <Card hero className="flex flex-col gap-3">
            <Eyebrow>Today&apos;s workout</Eyebrow>
            <EmptyState title="Nothing programmed today">Rest up, or check the schedule for open gym.</EmptyState>
          </Card>
        )}
      </section>

      <section aria-label="Next class">
        <Card hero className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <Eyebrow>{nextClass?.my_status === "going" ? "Your next class" : "Next class"}</Eyebrow>
            <Link href="/schedule" className="text-[13px] font-semibold text-accent">
              Full schedule
            </Link>
          </div>
          {nextClass ? (
            <>
              <div className="flex items-center gap-3.5">
                <div className="flex size-16 flex-none flex-col items-center justify-center rounded-2xl bg-graphite">
                  <div className="font-display text-[26px] font-extrabold leading-none">{formatTime(nextClass.starts_at, timeZone).time}</div>
                  <div className="text-[10px] font-bold tracking-[0.12em] text-ash">{formatTime(nextClass.starts_at, timeZone).ampm}</div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="truncate text-[17px] font-bold">{nextClass.title}</div>
                  <div className="truncate text-[13px] text-mist">
                    {dateKeyIn(new Date(nextClass.starts_at), timeZone) === today
                      ? "Today"
                      : formatDateKey(dateKeyIn(new Date(nextClass.starts_at), timeZone), { weekday: "long" })}
                    {nextClass.coach_label ? ` · ${nextClass.coach_label}` : ""} · {nextClass.duration_min} min
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={nextClass.going_count} max={nextClass.capacity} />
                    <span className="text-xs font-semibold text-fog">
                      {nextClass.going_count}/{nextClass.capacity}
                    </span>
                  </div>
                </div>
              </div>
              <NextClassRsvp sessionId={nextClass.id} status={nextClass.my_status} full={nextClass.going_count >= nextClass.capacity} />
            </>
          ) : (
            <p className="m-0 text-sm text-mist">No classes scheduled in the next week.</p>
          )}
        </Card>
      </section>

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-2.5">
        {actions.map(({ href, title, sub, Icon }) => (
          <Link key={href} href={href} className="press flex flex-col gap-[18px] rounded-card border border-line bg-charcoal p-3.5 hover:border-edge">
            <span className="flex size-10 items-center justify-center rounded-xl bg-graphite text-accent">
              <Icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">{title}</span>
              <span className="mt-0.5 block truncate text-xs text-mist">{sub}</span>
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
