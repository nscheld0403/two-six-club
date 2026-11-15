"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { CredentialCard } from "@/components/credential-card";
import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Segmented, TextInput, inputClasses } from "@/components/ui/form";
import { Avatar, Badge, Card, Display, EmptyState, type BadgeTone } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { ProfileRow, MemberStatus } from "@/lib/supabase/database.types";
import { SEX_OPTIONS } from "@/lib/validation";
import {
  approveMember,
  declineMember,
  reactivateMember,
  removeMember,
  resetAccess,
  suspendMember,
  updateMemberDetails,
  type ActionResult,
} from "./actions";

type Member = Pick<
  ProfileRow,
  "id" | "member_code" | "display_name" | "age" | "sex" | "role" | "status" | "created_at" | "approved_at" | "access_reset_at"
>;

const statusTone: Record<MemberStatus, BadgeTone> = {
  active: "accent",
  pending: "strength",
  suspended: "warn",
  declined: "neutral",
};

const sexLabel = { male: "M", female: "F", undisclosed: "—" } as const;

const filters: Array<{ id: "all" | MemberStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
  { id: "declined", label: "Declined" },
];

export function MembersManager({ members, selfId }: { members: Member[]; selfId: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | MemberStatus>("all");
  const [selected, setSelected] = useState<Member | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [issuedCode, setIssuedCode] = useState<{ name: string; code: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const pending = members.filter((m) => m.status === "pending");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return members.filter(
      (m) =>
        (filter === "all" || m.status === filter) &&
        (!term || m.display_name.toLowerCase().includes(term) || m.member_code.toLowerCase().includes(term)),
    );
  }, [members, q, filter]);

  function run(fn: () => Promise<ActionResult>, success: string, after?: (r: ActionResult) => void) {
    startTransition(async () => {
      const r = await fn();
      setNotice(r.ok ? { ok: true, text: r.message ?? success } : { ok: false, text: r.message });
      if (r.ok) after?.(r);
    });
  }

  function openMember(m: Member) {
    setSelected(m);
    setIssuedCode(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setSelected(null);
    setIssuedCode(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {notice ? (
        <div
          role="status"
          className={cn(
            "flex items-center gap-3 rounded-button border px-4 py-3 text-sm",
            notice.ok ? "border-accent/40 bg-accent/12" : "border-conditioning/40 bg-conditioning/12",
          )}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="text-lg text-mist">
            ×
          </button>
        </div>
      ) : null}

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <Display as="h2" size="h2" className="text-2xl">
            Join requests
          </Display>
          <span className="text-[13px] text-mist">{pending.length} pending</span>
        </div>
        {pending.length === 0 ? (
          <EmptyState title="You're all caught up" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-matte p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={p.display_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">
                      {p.display_name} <span className="font-medium text-mist">· {p.age}</span>
                    </div>
                    <div className="text-xs text-mist">
                      Requested {new Date(p.created_at).toLocaleDateString()} · <span className="font-mono">{p.member_code}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-10 flex-1 rounded-[10px]"
                    disabled={isPending}
                    onClick={() => run(() => approveMember(p.id), `${p.display_name} approved.`)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-10 flex-1 rounded-[10px] bg-transparent"
                    disabled={isPending}
                    onClick={() => run(() => declineMember(p.id), `${p.display_name} declined.`)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Display as="h2" size="h2" className="text-2xl">
            All members · {members.length}
          </Display>
          <label className="relative flex flex-[0_1_320px] items-center">
            <span className="absolute left-3.5 text-ash">
              <SearchIcon size={16} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search members"
              placeholder="Search by name or member code"
              className={cn(inputClasses, "h-11 bg-matte pl-10 text-sm")}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "press h-9 rounded-full border px-3.5 text-[13px] font-semibold",
                filter === f.id ? "border-accent bg-accent text-accent-ink" : "border-hairline text-fog",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState title={members.length ? "No members match" : "No members yet"}>
            {members.length ? "Try another search or filter." : "Share the join link with people you want in the club."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-[0.12em] text-ash">
                  <th className="border-b border-line px-2 py-2.5 font-semibold">MEMBER</th>
                  <th className="border-b border-line px-2 py-2.5 font-semibold">CODE</th>
                  <th className="border-b border-line px-2 py-2.5 font-semibold">AGE · SEX</th>
                  <th className="border-b border-line px-2 py-2.5 font-semibold">JOINED</th>
                  <th className="border-b border-line px-2 py-2.5 font-semibold">STATUS</th>
                  <th className="border-b border-line px-2 py-2.5 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="hover:bg-[#18181b]">
                    <td className="border-b border-graphite px-2 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.display_name} size={32} />
                        <span className="font-semibold">{m.display_name}</span>
                        {m.role === "admin" ? <Badge tone="inverse">Admin</Badge> : null}
                      </div>
                    </td>
                    <td className="border-b border-graphite px-2 py-2.5 font-mono text-fog">{m.member_code}</td>
                    <td className="border-b border-graphite px-2 py-2.5 text-fog">
                      {m.age} · {sexLabel[m.sex]}
                    </td>
                    <td className="border-b border-graphite px-2 py-2.5 text-fog">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="border-b border-graphite px-2 py-2.5">
                      <Badge tone={statusTone[m.status]}>{m.status}</Badge>
                    </td>
                    <td className="border-b border-graphite px-2 py-2.5 text-right">
                      <Button variant="secondary" size="sm" className="h-9 rounded-[10px]" onClick={() => openMember(m)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <dialog
        ref={dialogRef}
        onClose={() => setSelected(null)}
        className="m-auto w-[min(520px,calc(100vw-32px))] rounded-hero border border-line bg-charcoal p-0 text-chalk backdrop:bg-black/70"
      >
        {selected ? (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex items-center gap-3">
              <Avatar name={selected.display_name} size={48} />
              <div className="flex-1">
                <div className="text-lg font-bold">{selected.display_name}</div>
                <div className="text-[13px] text-mist">
                  <span className="font-mono">{selected.member_code}</span> ·{" "}
                  <Badge tone={statusTone[selected.status]} className="h-5 align-middle">
                    {selected.status}
                  </Badge>
                </div>
              </div>
              <button type="button" aria-label="Close" onClick={closeDialog} className="size-11 text-2xl text-mist">
                ×
              </button>
            </div>

            {issuedCode ? (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-sm text-fog">
                  Give this new code to {issuedCode.name} in person or by private message. Their old code and any
                  signed-in devices no longer work.
                </p>
                <CredentialCard code={issuedCode.code} name={issuedCode.name} />
              </div>
            ) : (
              <>
                <form
                  className="flex flex-col gap-4"
                  action={(fd) => run(() => updateMemberDetails(selected.id, fd), "Details saved.")}
                >
                  <Field label="Name" htmlFor="m-name">
                    <TextInput id="m-name" name="displayName" defaultValue={selected.display_name} className="bg-matte" />
                  </Field>
                  <Field label="Age" htmlFor="m-age">
                    <TextInput id="m-age" name="age" inputMode="numeric" defaultValue={selected.age} className="w-[140px] bg-matte" />
                  </Field>
                  <Segmented name="sex" legend="Sex" options={SEX_OPTIONS} defaultValue={selected.sex} />
                  <Button type="submit" variant="inverse" size="sm" disabled={isPending}>
                    Save details
                  </Button>
                </form>

                {selected.id === selfId ? (
                  <p className="m-0 border-t border-line pt-5 text-[13px] leading-relaxed text-mist">
                    To replace your own coach code, use <strong className="text-fog">Lost your coach code?</strong> on the{" "}
                    <a href="/setup" className="text-accent underline">setup page</a> with your setup code.
                  </p>
                ) : (
                <div className="flex flex-col gap-2 border-t border-line pt-5">
                  <div className="text-[13px] font-semibold text-fog">Access</div>
                  <p className="m-0 text-[13px] leading-relaxed text-mist">
                    Lost code? Issue a new one. It signs them out on every device.
                    {selected.access_reset_at
                      ? ` Last reset ${new Date(selected.access_reset_at).toLocaleDateString()}.`
                      : ""}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      run(() => resetAccess(selected.id), "New sign-in code issued.", (r) => {
                        if (r.ok && r.signInCode) setIssuedCode({ name: selected.display_name, code: r.signInCode });
                      })
                    }
                  >
                    Reset sign-in code
                  </Button>
                </div>
                )}

                {selected.id !== selfId ? (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-5">
                    {selected.status !== "active" ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={isPending}
                        onClick={() =>
                          run(
                            () => (selected.status === "pending" ? approveMember(selected.id) : reactivateMember(selected.id)),
                            `${selected.display_name} is active.`,
                            closeDialog,
                          )
                        }
                      >
                        {selected.status === "pending" ? "Approve" : "Reactivate"}
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        disabled={isPending}
                        onClick={() => run(() => suspendMember(selected.id), `${selected.display_name} suspended.`, closeDialog)}
                      >
                        Suspend
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      disabled={isPending}
                      onClick={() => {
                        if (window.confirm(`Delete ${selected.display_name} and all of their data? This can't be undone.`)) {
                          run(() => removeMember(selected.id), `${selected.display_name} deleted.`, closeDialog);
                        }
                      }}
                    >
                      Delete member
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
