import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Display, Wordmark } from "@/components/ui/primitives";
import { PageSkeleton } from "@/components/skeleton";
import { adminExists } from "./actions";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Setup" };

async function SetupGate() {
  let done = false;
  let problem: string | null = null;
  try {
    done = await adminExists();
  } catch {
    problem = "The app can't reach the database yet. Check the Supabase keys in the hosting settings and that the database setup script ran.";
  }
  if (problem) {
    return <p className="m-0 rounded-button bg-conditioning/14 px-4 py-3 text-sm text-conditioning">{problem}</p>;
  }
  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Display>Setup complete</Display>
        <p className="m-0 text-base text-mist">The administrator account already exists.</p>
        <ButtonLink href="/sign-in" size="lg">
          Sign in
        </ButtonLink>
      </div>
    );
  }
  return <SetupForm />;
}

export default function SetupPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pb-9 pt-7">
      <Wordmark sub="FIRST-TIME SETUP" />
      <Suspense fallback={<PageSkeleton />}>
        <SetupGate />
      </Suspense>
    </main>
  );
}
