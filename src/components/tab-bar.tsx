"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, HomeIcon, PlusIcon, RanksIcon, TrendIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/schedule", label: "Schedule", Icon: CalendarIcon },
  { href: "/log", label: "Log result", Icon: PlusIcon, primary: true },
  { href: "/leaderboard", label: "Ranks", Icon: RanksIcon },
  { href: "/progress", label: "Progress", Icon: TrendIcon },
] as const;

/** Tab bar that highlights the current route. Wrap in <Suspense fallback={<TabBarView />}>. */
export function TabBar() {
  return <TabBarView pathname={usePathname()} />;
}

export function TabBarView({ pathname = "" }: { pathname?: string }) {
  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-20 flex items-center justify-around border-t border-graphite bg-matte/95 px-2.5 pt-2 backdrop-blur"
      style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      {tabs.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        if ("primary" in t) {
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              className="press flex size-[54px] items-center justify-center rounded-[18px] bg-accent text-accent-ink"
            >
              <t.Icon size={24} />
            </Link>
          );
        }
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-[52px] w-16 flex-col items-center justify-center gap-1",
              active ? "text-accent" : "text-ash hover:text-fog",
            )}
          >
            <t.Icon size={22} />
            <span className="text-[10.5px] font-semibold">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
