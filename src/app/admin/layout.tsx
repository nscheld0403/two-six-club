import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { PageSkeleton, SkeletonBlock } from "@/components/skeleton";
import { Avatar, Wordmark } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export const metadata = { title: { default: "Coach admin", template: "%s · Coach admin" } };

/** Renders children only for the administrator. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

async function AdminSidebarNav() {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return <AdminNav pendingCount={count ?? 0} />;
}

async function AdminIdentity() {
  const me = await requireAdmin();
  return (
    <div className="flex items-center gap-2.5 px-2">
      <Avatar name={me.display_name} />
      <div>
        <div className="text-[13px] font-semibold">{me.display_name}</div>
        <div className="text-xs text-ash">Administrator</div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-wrap items-stretch">
      <aside className="flex flex-[1_1_232px] flex-col gap-6 border-b border-graphite px-4 py-6 md:border-b-0 md:border-r">
        <div className="px-2">
          <Wordmark sub="COACH ADMIN" />
        </div>
        <Suspense fallback={<AdminNav pendingCount={0} />}>
          <AdminSidebarNav />
        </Suspense>
        <div className="hidden flex-1 md:block" />
        <Link
          href="/"
          className="press flex h-11 items-center justify-center gap-2 rounded-xl border border-hairline text-[13px] font-semibold text-fog"
        >
          <ChevronLeftIcon size={16} /> Back to member app
        </Link>
        <Suspense fallback={<SkeletonBlock className="h-9 w-40 rounded-xl" />}>
          <AdminIdentity />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-[999_1_560px] px-4 pb-12 pt-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
          <Suspense fallback={<PageSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
