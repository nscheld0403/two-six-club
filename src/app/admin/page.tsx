import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Overview" };

const actionLabels: Record<string, string> = {
  "member.status": "Status changed",
  "member.role": "Role changed",
  "member.access_reset": "Access reset",
  "member.deleted": "Member deleted",
};

function msAgo(days: number) {
  return Date.now() - days * 24 * 3600 * 1000;
}

export default async function AdminOverview() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: members }, { data: log }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, status, created_at"),
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  const all = members ?? [];
  const names = new Map(all.map((m) => [m.id, m.display_name]));
  const active = all.filter((m) => m.status === "active").length;
  const pending = all.filter((m) => m.status === "pending");
  const monthAgo = msAgo(30);
  const joinedThisMonth = all.filter((m) => m.status === "active" && new Date(m.created_at).getTime() > monthAgo).length;

  const kpis = [
    { k: "Active members", v: active, d: `${joinedThisMonth} joined in the last 30 days` },
    { k: "Join requests", v: pending.length, d: pending.length ? "Awaiting review" : "All clear" },
    { k: "Total accounts", v: all.length, d: "Including pending and paused" },
  ];

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="text-xs">{today}</Eyebrow>
          <Display className="mt-1 text-[48px]">Club overview</Display>
        </div>
        <ButtonLink href="/admin/members" variant="primary" size="sm">
          Review members
        </ButtonLink>
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {kpis.map((k) => (
          <Card key={k.k} className="p-[18px]">
            <Eyebrow>{k.k}</Eyebrow>
            <div className="font-display text-[44px] font-bold leading-[1.05]">{k.v}</div>
            <div className="text-xs text-mist">{k.d}</div>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[2_1_320px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <Display as="h2" size="h2" className="text-2xl">
              Join requests
            </Display>
            <Link href="/admin/members" className="text-[13px] font-semibold text-accent">
              Manage
            </Link>
          </div>
          {pending.length === 0 ? (
            <EmptyState title="You're all caught up" />
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
              {pending.map((p) => (
                <li key={p.id} className="flex justify-between py-3 text-sm">
                  <span className="font-semibold">{p.display_name}</span>
                  <span className="text-mist">{new Date(p.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 flex-[3_1_420px] p-5">
          <Display as="h2" size="h2" className="mb-3 text-2xl">
            Recent activity
          </Display>
          {(log ?? []).length === 0 ? (
            <EmptyState title="No admin activity yet" />
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
              {(log ?? []).map((e) => {
                const d = e.details as { from?: string; to?: string };
                return (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{actionLabels[e.action] ?? e.action}</span>
                      {e.target_id ? <span className="text-mist"> · {names.get(e.target_id) ?? "Member"}</span> : null}
                      {d.from && d.to ? (
                        <span className="text-mist">
                          {" "}
                          ({d.from} → {d.to})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-ash">{new Date(e.created_at).toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
