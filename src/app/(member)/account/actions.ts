"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validation";

export type AccountState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

export async function updateAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const me = await requireActiveMember();
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    age: formData.get("age"),
    sex: formData.get("sex"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your details" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      age: parsed.data.age,
      sex: parsed.data.sex,
      results_visible: formData.get("resultsVisible") === "on",
      show_demographics: formData.get("showDemographics") === "on",
    })
    .eq("id", me.id);
  if (error) return { status: "error", message: "Couldn't save. Try again." };
  revalidatePath("/", "layout");
  return { status: "saved" };
}
