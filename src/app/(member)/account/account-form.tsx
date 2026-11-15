"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Segmented, TextInput } from "@/components/ui/form";
import { Card } from "@/components/ui/primitives";
import type { MemberSex } from "@/lib/supabase/database.types";
import { SEX_OPTIONS } from "@/lib/validation";
import { updateAccount, type AccountState } from "./actions";

type Props = {
  profile: { displayName: string; age: number; sex: MemberSex; resultsVisible: boolean; showDemographics: boolean };
};

function Toggle({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-mist">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-track transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-chalk" />
        <span className="absolute left-1 top-1 size-5 rounded-full bg-chalk transition-transform peer-checked:translate-x-5 peer-checked:bg-matte" />
      </span>
    </label>
  );
}

export function AccountForm({ profile }: Props) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateAccount, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5">
        <Field label="Name" htmlFor="displayName">
          <TextInput id="displayName" name="displayName" defaultValue={profile.displayName} maxLength={60} required />
        </Field>
        <Field label="Age" htmlFor="age">
          <TextInput id="age" name="age" inputMode="numeric" defaultValue={profile.age} className="w-[140px]" required />
        </Field>
        <Segmented name="sex" legend="Sex" options={SEX_OPTIONS} defaultValue={profile.sex} />
      </Card>

      <Card className="flex flex-col divide-y divide-line py-1">
        <Toggle
          name="resultsVisible"
          label="Show my results to members"
          description="When off, only you and the coach can see your scores."
          defaultChecked={profile.resultsVisible}
        />
        <Toggle
          name="showDemographics"
          label="Include me in sex and age divisions"
          description="Lets leaderboards filter by sex and age group. Your exact age is never shown."
          defaultChecked={profile.showDemographics}
        />
      </Card>

      {state.status === "error" ? (
        <p role="alert" className="m-0 text-sm font-medium text-conditioning">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} variant={state.status === "saved" && !pending ? "soft" : "primary"}>
        {pending ? "Saving…" : state.status === "saved" ? "Saved" : "Save changes"}
      </Button>
    </form>
  );
}
