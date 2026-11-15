"use client";

import { useActionState } from "react";
import { CredentialCard } from "@/components/credential-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Segmented, TextInput } from "@/components/ui/form";
import { Display } from "@/components/ui/primitives";
import { SEX_OPTIONS } from "@/lib/validation";
import { createFirstAdmin, recoverAdmin, type SetupState } from "./actions";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(createFirstAdmin, { status: "idle" });

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-5">
        <Display>You&apos;re the coach.</Display>
        <p className="m-0 text-base text-mist">
          This is your administrator sign-in code. Save it somewhere safe, like a password manager. Anyone with this code can
          manage the club.
        </p>
        <CredentialCard code={state.signInCode} name={state.displayName} />
        <ButtonLink href="/admin" size="lg">
          Open the coach dashboard
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <Display>Create the admin</Display>
        <p className="mb-0 mt-2 text-[15px] leading-normal text-mist">
          This page works once, to create the club&apos;s administrator. Enter the setup code you saved in Vercel.
        </p>
      </div>
      <Field label="Setup code" htmlFor="setupCode">
        <TextInput id="setupCode" name="setupCode" type="password" autoComplete="off" required />
      </Field>
      <Field label="Your name" htmlFor="displayName">
        <TextInput id="displayName" name="displayName" autoComplete="name" maxLength={60} required />
      </Field>
      <Field label="Birthday" htmlFor="birthDate">
        <TextInput id="birthDate" name="birthDate" type="date" className="w-[200px] [color-scheme:dark]" required />
      </Field>
      <Segmented name="sex" legend="Sex" hint="optional" options={SEX_OPTIONS} defaultValue="undisclosed" />
      {state.status === "error" ? (
        <p role="alert" className="m-0 rounded-button bg-conditioning/14 px-4 py-3 text-sm font-medium text-conditioning">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create admin account"}
      </Button>
    </form>
  );
}

/** "Lost your coach code?" — issue a new one with the private setup code. */
export function RecoverForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(recoverAdmin, { status: "idle" });

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 border-t border-line pt-6">
        <Display as="h2" className="text-[30px]">
          Your new coach code
        </Display>
        <p className="m-0 text-[15px] text-mist">
          Your old code no longer works. Save this one now: take a screenshot, or use Copy and paste it into your notes
          or password manager.
        </p>
        <CredentialCard code={state.signInCode} name={state.displayName} />
        <ButtonLink href="/admin" size="lg">
          Open the coach dashboard
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 border-t border-line pt-6">
      <div>
        <Display as="h2" className="text-[30px]">
          Lost your coach code?
        </Display>
        <p className="mb-0 mt-2 text-[15px] leading-normal text-mist">
          Enter the setup code you saved in Vercel to get a new coach sign-in code.
        </p>
      </div>
      <Field label="Setup code" htmlFor="recoverCode">
        <TextInput id="recoverCode" name="setupCode" type="password" autoComplete="off" required />
      </Field>
      {state.status === "error" ? (
        <p role="alert" className="m-0 rounded-button bg-conditioning/14 px-4 py-3 text-sm font-medium text-conditioning">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" size="lg" disabled={pending}>
        {pending ? "Issuing…" : "Get a new coach code"}
      </Button>
    </form>
  );
}
