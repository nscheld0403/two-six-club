import Link from "next/link";
import { CalendarIcon, PlusIcon, RanksIcon, TrendIcon } from "@/components/icons";
import { Card, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { brand } from "@/config/brand";
import { requireActiveMember } from "@/lib/auth";

export const metadata = { title: "Home" };

function greeting(date: Date) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: brand.timeZone }).format(date));
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

export default async function HomePage() {
  const me = await requireActiveMember();
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: brand.timeZone });
  const first = me.display_name.split(" ")[0];

  const actions = [
    { href: "/schedule", title: "Book a class", sub: "See this week", Icon: CalendarIcon },
    { href: "/log", title: "Log result", sub: "Record a workout", Icon: PlusIcon },
    { href: "/leaderboard", title: "Leaderboard", sub: "Club rankings", Icon: RanksIcon },
    { href: "/progress", title: "My PRs", sub: "Records & trends", Icon: TrendIcon },
  ];

  return (
    <>
      <section className="flex flex-col gap-1 pt-1">
        <Eyebrow className="text-xs">{dateLabel}</Eyebrow>
        <Display className="text-[44px]">
          {greeting(now)}, {first}.
        </Display>
      </section>

      <section aria-label="Today's workout">
        <Card hero className="flex flex-col gap-3">
          <Eyebrow>Today&apos;s workout</Eyebrow>
          <EmptyState title="Nothing programmed yet">
            When the coach publishes today&apos;s workout, it will appear here.
          </EmptyState>
        </Card>
      </section>

      <section aria-label="Next class">
        <Card hero className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Eyebrow>Next class</Eyebrow>
            <Link href="/schedule" className="text-[13px] font-semibold text-accent">
              Full schedule
            </Link>
          </div>
          <p className="m-0 text-sm text-mist">No upcoming classes yet.</p>
        </Card>
      </section>

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-2.5">
        {actions.map(({ href, title, sub, Icon }) => (
          <Link
            key={href}
            href={href}
            className="press flex flex-col gap-[18px] rounded-card border border-line bg-charcoal p-3.5 hover:border-edge"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-graphite text-accent">
              <Icon size={20} />
            </span>
            <span>
              <span className="block text-[15px] font-bold">{title}</span>
              <span className="mt-0.5 block text-xs text-mist">{sub}</span>
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
