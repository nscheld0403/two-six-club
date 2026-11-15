import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { disciplineMeta } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateKey, isDateKey, mondayOf, todayKey, WEEKDAYS } from "@/lib/time";

export const metadata = { title: "Programming" };

export default async function ProgrammingPage({ searchParams }: PageProps<"/admin/programming">) {
  await requireAdmin();
  const sp = await searchParams;
  const { timeZone } = await getClubSettings();
  const today = todayKey(timeZone);
  const monday = mondayOf(typeof sp.week === "string" && isDateKey(sp.week) ? sp.week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const supabase = await createClient();

  const [{ data: workouts }, { data: templates }] = await Promise.all([
    supabase.from("workouts").select("id, title, workout_date, status, discipline, publish_at").eq("is_template", false).gte("workout_date", monday).lte("workout_date", addDays(monday, 6)).order("created_at"),
    supabase.from("workouts").select("id, title, discipline, updated_at").eq("is_template", true).order("title"),
  ]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="text-xs">
            Week of {formatDateKey(monday, { month: "long", day: "numeric" })}
          </Eyebrow>
          <Display className="mt-1 text-[48px]">Programming</Display>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/programming?week=${addDays(monday, -7)}`} aria-label="Previous week" className="press flex size-11 items-center justify-center rounded-full border border-hairline">
            <ChevronLeftIcon size={18} />
          </Link>
          <Link href={`/admin/programming?week=${addDays(monday, 7)}`} aria-label="Next week" className="press flex size-11 items-center justify-center rounded-full border border-hairline">
            <ChevronRightIcon size={18} />
          </Link>
          <ButtonLink href={`/admin/programming/new?date=${days.includes(today) ? today : monday}`} size="sm">
            <PlusIcon size={16} /> New workout
          </ButtonLink>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[3_1_520px] flex-col gap-2.5">
          {days.map((d, i) => {
            const list = (workouts ?? []).filter((w) => w.workout_date === d);
            return (
              <Card key={d} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="w-14 flex-none">
                  <div className={d === today ? "text-xs font-bold tracking-[0.08em] text-accent" : "text-xs font-bold tracking-[0.08em] text-ash"}>{WEEKDAYS[i].toUpperCase()}</div>
                  <div className="font-display text-[26px] font-bold leading-none">{Number(d.slice(8))}</div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {list.length === 0 ? <span className="text-sm text-ash">Nothing programmed</span> : null}
                  {list.map((w) => (
                    <Link key={w.id} href={`/admin/programming/${w.id}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-graphite">
                      <span className="size-2 flex-none rounded-full" style={{ background: disciplineMeta(w.discipline).color }} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{w.title}</span>
                      <Badge tone={w.status === "published" ? (w.publish_at && new Date(w.publish_at) > new Date() ? "info" : "accent") : "neutral"}>
                        {w.status === "published" ? (w.publish_at && new Date(w.publish_at) > new Date() ? "Scheduled" : "Live") : "Draft"}
                      </Badge>
                    </Link>
                  ))}
                </div>
                <ButtonLink href={`/admin/programming/new?date=${d}`} variant="secondary" size="sm" className="h-9 rounded-[10px]" aria-label={`Add workout on ${formatDateKey(d, { weekday: "long" })}`}>
                  <PlusIcon size={14} /> Add
                </ButtonLink>
              </Card>
            );
          })}
        </section>

        <aside className="flex min-w-0 flex-[2_1_300px] flex-col gap-3">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <Display as="h2" size="h2" className="text-2xl">
                Templates
              </Display>
              <ButtonLink href="/admin/programming/new?template=1" variant="ghost" size="sm" className="px-0">
                <PlusIcon size={14} /> New
              </ButtonLink>
            </div>
            {templates?.length ? (
              <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-2.5">
                    <Link href={`/admin/programming/${t.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-accent">
                      {t.title}
                    </Link>
                    <Link href={`/admin/programming/new?from=${t.id}&date=${days.includes(today) ? today : monday}`} className="text-[13px] font-semibold text-accent">
                      Use
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No templates yet">Save a workout as a template to reuse benchmarks and favourite formats.</EmptyState>
            )}
          </Card>
          <p className="m-0 px-1 text-xs leading-relaxed text-ash">
            Drafts are only visible to you. Live workouts appear on members&apos; Home and Workout screens. A scheduled reveal
            time keeps a workout hidden until then.
          </p>
        </aside>
      </div>
    </>
  );
}
