"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import type { RsvpStatus } from "@/lib/supabase/database.types";
import { setRsvp } from "./schedule/actions";

export function NextClassRsvp({ sessionId, status, full }: { sessionId: string; status: RsvpStatus | null; full: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(next: RsvpStatus) {
    const before = current;
    setCurrent(next);
    setError(null);
    start(async () => {
      const r = await setRsvp(sessionId, next);
      if (!r.ok) {
        setCurrent(before);
        setError(r.message);
      } else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        {current === "going" ? (
          <>
            <Button variant="ghost" size="sm" className="text-mist" disabled={pending} onClick={() => change("not_going")}>
              Can&apos;t make it
            </Button>
            <Button variant="soft" size="pill" disabled={pending} onClick={() => change("maybe")} aria-label="You're going. Tap to change to maybe">
              <CheckIcon size={16} /> You&apos;re in
            </Button>
          </>
        ) : full ? (
          <ButtonLink href="/schedule" variant="secondary" size="pill" className="rounded-full">
            Class full · see others
          </ButtonLink>
        ) : (
          <Button variant="inverse" size="pill" className="px-5" disabled={pending} onClick={() => change("going")}>
            Reserve spot
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="m-0 text-right text-[13px] text-conditioning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
