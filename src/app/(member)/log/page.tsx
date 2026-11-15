import Link from "next/link";
import { CheckIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Card, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { requireActiveMember } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { formatScore, scoringLabel } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateKey, todayKey } from "@/lib/time";
import { loadWorkouts } from "@/lib/workouts";

export const metadata = { title: "Log result" };

export default async function LogPage() {
  const me = await requireActiveMember();
  const { timeZone } = await getClubSettings();
  const today = todayKey(timeZone);
  const workouts = await loadWorkouts({ from: addDays(today, -13), to: today });
  const sectionIds = workouts.flatMap((w) => w.sections.filter((s) => s.scoring !== "none").map((s) => s.id));

  const supabase = await createClient();
  const [{ data: mine }, { data: recentFree }] = await Promise.all([
    sectionIds.length
      ? supabase.from("results").select("*").eq("member_id", me.id).in("section_id", sectionIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("results")
      .select("*")
      .eq("member_id", me.id)
      .is("section_id", null)
      .order("performed_on", { ascending: false })
      .limit(5),
  ]);
  const bySection = new Map((mine ?? []).map((r) => [r.section_id, r]));

  const scoredWorkouts = workouts.filter((w) => w.sections.some((s) => s.scoring !== "none"));

  return (
    <>
      <section className="flex flex-col gap-1 pt-1">
        <Eyebrow className="text-xs">Last two weeks</Eyebrow>
        <Display>Log result</Display>
      </section>

      <ButtonLink href="/log/new" variant="secondary" size="lg" className="justify-between">
        <span className="flex items-center gap-2">
          <PlusIcon size={18} className="text-accent" /> Log a lift or other workout
        </span>
        <ChevronRightIcon size={18} />
      </ButtonLink>

      {scoredWorkouts.length === 0 ? (
        <EmptyState title="No programmed workouts to log">
          When the coach publishes a workout, it shows up here so you can record your result.
        </EmptyState>
      ) : (
        scoredWorkouts.map((w) => (
          <Card key={w.id} className="flex flex-col gap-1 py-3">
            <div className="flex items-baseline justify-between gap-3 pb-1">
              <Link href={`/workouts/${w.id}`} className="min-w-0 truncate font-display text-[22px] font-bold uppercase">
                {w.title}
              </Link>
              <span className="flex-none text-xs text-mist">
                {w.workout_date === today ? "Today" : formatDateKey(w.workout_date!, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </div>
            {w.sections
              .filter((s) => s.scoring !== "none")
              .map((s) => {
                const r = bySection.get(s.id);
                return (
                  <Link
                    key={s.id}
                    href={`/log/${s.id}`}
                    className="press -mx-2 flex items-center gap-3 rounded-xl border-t border-line px-2 py-3 first:border-t-0 hover:bg-graphite"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{s.title}</span>
                      <span className="text-xs text-mist">{scoringLabel(s.scoring)}</span>
                    </span>
                    {r ? (
                      <span className="flex items-center gap-1.5 font-display text-xl font-bold">
                        <CheckIcon size={14} className="text-accent" />
                        {formatScore(r)}
                      </span>
                    ) : (
                      <span className="flex h-9 items-center rounded-full bg-chalk px-3.5 text-[13px] font-bold text-matte">Log</span>
                    )}
                  </Link>
                );
              })}
          </Card>
        ))
      )}

      {recentFree?.length ? (
        <section className="flex flex-col gap-2.5">
          <Display as="h2" size="h2" className="px-0.5">
            Your other logs
          </Display>
          <Card className="py-1">
            {recentFree.map((r) => (
              <Link
                key={r.id}
                href={`/log/new?edit=${r.id}`}
                className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.title}</span>
                  <span className="text-xs text-mist">{formatDateKey(r.performed_on, { month: "short", day: "numeric" })}</span>
                </span>
                <span className="font-display text-xl font-bold">{formatScore(r)}</span>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
