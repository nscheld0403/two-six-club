import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/(public)/actions";
import { Button } from "@/components/ui/button";
import { Card, Display, Eyebrow, Wordmark } from "@/components/ui/primitives";
import { PageSkeleton } from "@/components/skeleton";
import { requireSignedIn } from "@/lib/auth";

export const metadata = { title: "Membership status" };

const copy = {
  pending: {
    title: "Almost in.",
    body: "Your request is waiting for the coach's approval. This page updates once you're approved, so check back soon.",
    label: "Pending approval",
    tone: "text-strength",
  },
  suspended: {
    title: "Paused.",
    body: "Your membership is paused. Talk to the coach to reactivate it.",
    label: "Suspended",
    tone: "text-conditioning",
  },
  declined: {
    title: "Not this time.",
    body: "Your request wasn't approved. If you think that's a mistake, talk to the coach.",
    label: "Declined",
    tone: "text-conditioning",
  },
} as const;

async function PendingStatus() {
  const me = await requireSignedIn();
  if (me.status === "active") redirect("/");
  const c = copy[me.status];
  return (
    <>
      <main className="flex flex-1 flex-col justify-center gap-5">
        <Display size="display">{c.title}</Display>
        <p className="m-0 text-base leading-normal text-mist">{c.body}</p>
        <Card className="flex flex-col divide-y divide-line px-4 py-1">
          <div className="flex justify-between py-3.5 text-sm">
            <span className="text-mist">Name</span>
            <span className="font-semibold">{me.display_name}</span>
          </div>
          <div className="flex justify-between py-3.5 text-sm">
            <span className="text-mist">Member code</span>
            <span className="font-mono font-semibold">{me.member_code}</span>
          </div>
          <div className="flex justify-between py-3.5 text-sm">
            <span className="text-mist">Status</span>
            <span className={`font-bold ${c.tone}`}>{c.label}</span>
          </div>
        </Card>
        <Eyebrow className="normal-case tracking-normal text-[13px] font-medium leading-relaxed">
          You&apos;ll stay signed in on this device.
        </Eyebrow>
      </main>
      <form action={signOut}>
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    </>
  );
}

export default function PendingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-9 pt-7 md:border-x md:border-line">
      <Wordmark />
      <Suspense fallback={<div className="pt-10"><PageSkeleton /></div>}>
        <PendingStatus />
      </Suspense>
    </div>
  );
}
