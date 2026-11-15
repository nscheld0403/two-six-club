"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/form";
import { Display } from "@/components/ui/primitives";
import { memberAuthEmail, parseSignInCode } from "@/lib/credentials";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ emailDomain }: { emailDomain: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const raw = String(new FormData(e.currentTarget).get("code") ?? "");
    const parsed = parseSignInCode(raw);
    if (!parsed) {
      setError("That doesn't look like a sign-in code. It has 22 letters and numbers, like K7M3Q9-ABCD-….");
      return;
    }
    setPending(true);
    // Signing in from the browser keeps Supabase's per-device rate limits accurate.
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: memberAuthEmail(parsed.memberCode, emailDomain),
      password: parsed.accessKey,
    });
    setPending(false);
    if (authError) {
      setError(
        authError.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "That code didn't work. Check it, or ask the coach to reset your access.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col" noValidate>
      <header className="flex items-center justify-between px-5 pb-2 pt-[18px]">
        <Link
          href="/welcome"
          aria-label="Back"
          className="press flex size-11 items-center justify-center rounded-full border border-hairline"
        >
          <ChevronLeftIcon size={18} />
        </Link>
        <div className="text-[13px] font-semibold text-mist">Sign in</div>
        <div className="size-11" />
      </header>
      <main className="flex flex-1 flex-col gap-[22px] px-5 pb-5 pt-3">
        <div>
          <Display>Welcome back</Display>
          <p className="mb-0 mt-2 text-[15px] leading-normal text-mist">
            Enter the sign-in code you saved when you joined. Dashes and spaces are optional.
          </p>
        </div>
        <Field label="Sign-in code" htmlFor="code" error={error ?? undefined}>
          <textarea
            id="code"
            name="code"
            rows={2}
            autoCapitalize="characters"
            autoComplete="current-password"
            spellCheck={false}
            placeholder="K7M3Q9-ABCD-EFGH-JKMN-PQRS"
            aria-invalid={Boolean(error)}
            className={cn(inputClasses, "h-auto resize-none py-3.5 font-mono text-[17px] uppercase tracking-[0.06em]")}
          />
        </Field>
        <p className="m-0 text-[13px] leading-relaxed text-ash">
          Lost your code? Ask the coach. They can issue a new one, and your old code will stop working.
        </p>
      </main>
      <footer className="sticky bottom-0 border-t border-graphite bg-matte px-5 pb-8 pt-3">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="mb-0 mt-3 text-center text-sm text-mist">
          New here?{" "}
          <Link href="/join" className="font-semibold text-accent">
            Request to join
          </Link>
        </p>
      </footer>
    </form>
  );
}
