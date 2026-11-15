import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton, SkeletonBlock } from "@/components/skeleton";
import { TabBar } from "@/components/tab-bar";
import { ShieldIcon } from "@/components/icons";
import { Avatar, Wordmark } from "@/components/ui/primitives";
import { requireActiveMember } from "@/lib/auth";

/** Renders children only for active members; everyone else is redirected. */
async function MemberGate({ children }: { children: React.ReactNode }) {
  await requireActiveMember();
  return <>{children}</>;
}

async function HeaderActions() {
  const me = await requireActiveMember();
  return (
    <div className="flex items-center gap-2">
      {me.role === "admin" ? (
        <Link
          href="/admin"
          className="press flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3 text-xs font-semibold text-fog"
        >
          <ShieldIcon size={14} /> Coach
        </Link>
      ) : null}
      <Link href="/account" aria-label="My account" className="press rounded-full">
        <Avatar name={me.display_name} size={40} tone="accent" />
      </Link>
    </div>
  );
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col md:border-x md:border-line">
      <header className="flex items-center justify-between px-5 pb-2.5 pt-[18px]">
        <Link href="/" aria-label="Home">
          <Wordmark />
        </Link>
        <Suspense fallback={<SkeletonBlock className="size-10 rounded-full" />}>
          <HeaderActions />
        </Suspense>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-5 pb-7 pt-1.5">
        <Suspense fallback={<PageSkeleton />}>
          <MemberGate>{children}</MemberGate>
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
