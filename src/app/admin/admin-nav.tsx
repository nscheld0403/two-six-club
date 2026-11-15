"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/members", label: "Members" },
];

export function AdminNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "press flex h-11 flex-[1_1_180px] items-center gap-3 rounded-xl px-3 text-sm font-semibold",
              active ? "bg-graphite text-chalk" : "text-mist hover:bg-charcoal",
            )}
          >
            <span className={cn("size-2 rounded-full", active ? "bg-accent" : "bg-edge")} />
            <span className="flex-1">{item.label}</span>
            {item.href === "/admin/members" && pendingCount > 0 ? (
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-extrabold text-accent-ink">
                {pendingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
      <span className="flex h-11 flex-[1_1_180px] items-center gap-3 px-3 text-sm font-semibold text-ash/70" title="Arrives in Phase 2">
        <span className="size-2 rounded-full bg-line" />
        Programming &amp; classes
      </span>
    </nav>
  );
}
