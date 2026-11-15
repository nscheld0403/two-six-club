"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allowRegistrationAttempt, createMember } from "@/lib/members";
import { registrationSchema } from "@/lib/validation";

export type RegisterState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | { status: "success"; signInCode: string; displayName: string };

function clientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function registerMember(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = {
    displayName: String(formData.get("displayName") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    sex: String(formData.get("sex") ?? ""),
  };

  // Honeypot: real people never fill this hidden field.
  if (formData.get("website")) return { status: "error", message: "Something went wrong. Please try again." };

  const parsed = registrationSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", fieldErrors, values };
  }

  try {
    const allowed = await allowRegistrationAttempt(clientIp(await headers()));
    if (!allowed) {
      return { status: "error", message: "Too many sign-ups from this device. Try again in an hour.", values };
    }

    const member = await createMember(parsed.data);

    // Start a persistent session straight away.
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: member.email, password: member.accessKey });
    if (error) throw error;

    return { status: "success", signInCode: member.signInCode, displayName: parsed.data.displayName };
  } catch (err) {
    console.error("registerMember failed", err);
    return { status: "error", message: "We couldn't create your account. Please try again.", values };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/welcome");
}
