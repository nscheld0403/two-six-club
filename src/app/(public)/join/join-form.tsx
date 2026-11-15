"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerMember, type RegisterState } from "../actions";
import { CredentialCard } from "@/components/credential-card";
import { ArrowRightIcon, ChevronLeftIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Segmented, TextInput } from "@/components/ui/form";
import { Display, LogoMark } from "@/components/ui/primitives";
import { SEX_OPTIONS } from "@/lib/validation";

export function JoinForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerMember, { status: "idle" });

  if (state.status === "success") {
    return (
      <main className="flex flex-1 flex-col gap-6 px-6 pb-9 pt-7">
        <div className="flex flex-1 flex-col justify-center gap-5">
          <LogoMark size={56} />
          <Display size="display">
            Welcome,
            <br />
            {state.displayName.split(" ")[0]}.
          </Display>
          <p className="m-0 text-base leading-normal text-mist">
            Your request is with the coach. Once you&apos;re approved you can book classes and log results.
          </p>
          <CredentialCard code={state.signInCode} name={state.displayName} />
        </div>
        <ButtonLink href="/pending" size="lg">
          I&apos;ve saved my code <ArrowRightIcon size={16} />
        </ButtonLink>
      </main>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const values = state.status === "error" ? state.values ?? {} : {};

  return (
    <form action={action} className="flex flex-1 flex-col" noValidate>
      <header className="flex items-center justify-between px-5 pb-2 pt-[18px]">
        <Link
          href="/welcome"
          aria-label="Back"
          className="press flex size-11 items-center justify-center rounded-full border border-hairline"
        >
          <ChevronLeftIcon size={18} />
        </Link>
        <div className="text-[13px] font-semibold text-mist">Request to join</div>
        <div className="size-11" />
      </header>

      <main className="flex flex-1 flex-col gap-[22px] px-5 pb-5 pt-3">
        <div>
          <Display>About you</Display>
          <p className="mb-0 mt-2 text-[15px] leading-normal text-mist">
            That&apos;s all we need. No email or phone number.
          </p>
        </div>

        <Field label="Name" htmlFor="displayName" error={errors.displayName}>
          <TextInput
            id="displayName"
            name="displayName"
            autoComplete="name"
            maxLength={60}
            required
            defaultValue={values.displayName}
            aria-invalid={Boolean(errors.displayName)}
          />
        </Field>

        <Field label="Birthday" hint="only the coach sees the date" htmlFor="birthDate" error={errors.birthDate}>
          <TextInput
            id="birthDate"
            name="birthDate"
            type="date"
            required
            defaultValue={values.birthDate}
            aria-invalid={Boolean(errors.birthDate)}
            className="w-[200px] [color-scheme:dark]"
          />
        </Field>

        <Segmented
          name="sex"
          legend="Sex"
          hint="used for leaderboard divisions"
          options={SEX_OPTIONS}
          defaultValue={(values.sex as (typeof SEX_OPTIONS)[number]["value"]) || "undisclosed"}
          error={errors.sex}
        />

        {/* Honeypot for bots: hidden from people and assistive tech. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {state.status === "error" && state.message ? (
          <p role="alert" className="m-0 rounded-button bg-conditioning/14 px-4 py-3 text-sm font-medium text-conditioning">
            {state.message}
          </p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-graphite bg-matte px-5 pb-8 pt-3">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Creating your account…" : "Request membership"}
        </Button>
      </footer>
    </form>
  );
}
