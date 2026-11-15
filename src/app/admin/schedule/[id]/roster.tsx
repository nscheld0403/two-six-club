"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { Avatar, Badge, Card, Display, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { RsvpStatus } from "@/lib/supabase/database.types";
import { removeReservation, setAttendance } from "../actions";

type Res = { memberId: string; name: string; status: RsvpStatus; attended: boolean | null };

export function Roster({
  session,
  reservations,
  members,
}: {
  session: { id: string; title: string; capacity: number; when: string; week: string; cancelled: boolean };
  reservations: Res[];
  members: Array<{ id: string; name: string; code: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [add, setAdd] = useState("");

  const order: Record<RsvpStatus, number> = { going: 0, maybe: 1, not_going: 2 };
  const sorted = [...reservations].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  const going = reservations.filter((r) => r.status === "going").length;
  const present = reservations.filter((r) => r.attended === true).length;
  const notListed = members.filter((m) => !reservations.some((r) => r.memberId === m.id));

  function act(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href={`/admin/schedule?week=${session.week}`} aria-label="Back to schedule" className="press flex size-11 items-center justify-center rounded-full border border-hairline">
          <ChevronLeftIcon size={18} />
        </Link>
        <div>
          <Eyebrow className="text-xs">{session.when}</Eyebrow>
          <Display className="text-[40px]">{session.title}</Display>
        </div>
        {session.cancelled ? <Badge tone="warn">Cancelled</Badge> : null}
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {[
          { k: "Going", v: `${going}/${session.capacity}` },
          { k: "Maybe", v: reservations.filter((r) => r.status === "maybe").length },
          { k: "Checked in", v: present },
        ].map((x) => (
          <Card key={x.k} className="p-4">
            <Eyebrow>{x.k}</Eyebrow>
            <div className="font-display text-[36px] font-bold leading-tight">{x.v}</div>
          </Card>
        ))}
      </section>

      {error ? <div role="alert" className="rounded-button border border-conditioning/40 bg-conditioning/12 px-4 py-3 text-sm text-conditioning">{error}</div> : null}

      <Card className="flex flex-col gap-2 p-5">
        <Display as="h2" size="h2" className="text-2xl">
          Attendance
        </Display>
        {sorted.length === 0 ? (
          <EmptyState title="No RSVPs yet" />
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {sorted.map((r) => (
              <li key={r.memberId} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar name={r.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className={cn("text-xs", r.status === "going" ? "text-accent" : "text-mist")}>
                    {r.status === "going" ? "Going" : r.status === "maybe" ? "Maybe" : "Can't go"}
                  </span>
                </span>
                <div role="radiogroup" aria-label={`Attendance for ${r.name}`} className="flex rounded-xl border border-line bg-matte p-[3px]">
                  {[
                    { v: true, l: "Present" },
                    { v: false, l: "No-show" },
                  ].map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      role="radio"
                      aria-checked={r.attended === o.v}
                      disabled={pending}
                      onClick={() => act(() => setAttendance(session.id, r.memberId, r.attended === o.v ? null : o.v))}
                      className={cn(
                        "press h-9 rounded-[9px] px-3 text-[13px] font-bold",
                        r.attended === o.v ? (o.v ? "bg-accent text-accent-ink" : "bg-conditioning text-matte") : "text-mist",
                      )}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="text-mist" disabled={pending} onClick={() => act(() => removeReservation(session.id, r.memberId))} aria-label={`Remove ${r.name}`}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-wrap items-end gap-3 p-5">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-xs font-semibold text-mist">
          Walk-in or add a member
          <select value={add} onChange={(e) => setAdd(e.target.value)} className={cn(inputClasses, "h-12 bg-matte text-[15px]")}>
            <option value="">Choose a member…</option>
            {notListed.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code})
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={!add || pending}
          onClick={() =>
            act(async () => {
              const r = await setAttendance(session.id, add, true);
              if (r.ok) setAdd("");
              return r;
            })
          }
        >
          Check in
        </Button>
      </Card>
    </div>
  );
}
