"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRegistrationAttempt, createMember, resetMemberAccess } from "@/lib/members";
import { memberAuthEmail, parseSignInCode } from "@/lib/credentials";
import { publicEnv } from "@/lib/env";
import { registrationSchema } from "@/lib/validation";

export type SetupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; signInCode: string; displayName: string };

function codeMatches(input: string): boolean {
  const expected = process.env.ADMIN_SETUP_CODE ?? "";
  if (expected.length < 12) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function adminExists(): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** One-time creation of the administrator. Disabled as soon as an admin exists. */
export async function createFirstAdmin(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await allowRegistrationAttempt(ip))) return { status: "error", message: "Too many attempts. Try again in an hour." };
  if (!process.env.ADMIN_SETUP_CODE || process.env.ADMIN_SETUP_CODE.length < 12) {
    return { status: "error", message: "ADMIN_SETUP_CODE isn't set (it needs at least 12 characters) in the hosting settings." };
  }
  if (!codeMatches(String(formData.get("setupCode") ?? ""))) return { status: "error", message: "That setup code doesn't match." };
  if (await adminExists()) return { status: "error", message: "Setup is already complete." };

  const parsed = registrationSchema.safeParse({
    displayName: formData.get("displayName"),
    age: formData.get("age"),
    sex: formData.get("sex"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your details" };

  try {
    const member = await createMember(parsed.data, { role: "admin", status: "active" });
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email: member.email, password: member.accessKey });
    return { status: "success", signInCode: member.signInCode, displayName: parsed.data.displayName };
  } catch (err) {
    console.error("createFirstAdmin failed", err);
    return { status: "error", message: "Couldn't create the admin account. Check the database setup and keys." };
  }
}

/**
 * Lost coach code: whoever holds ADMIN_SETUP_CODE (set privately in the
 * hosting settings) can issue the administrator a fresh sign-in code. The old
 * code stops working and every device is signed out.
 */
export async function recoverAdmin(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await allowRegistrationAttempt(ip))) return { status: "error", message: "Too many attempts. Try again in an hour." };
  if (!codeMatches(String(formData.get("setupCode") ?? ""))) return { status: "error", message: "That setup code doesn't match." };

  const admin = createAdminClient();
  const { data: coach, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("role", "admin")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error || !coach) return { status: "error", message: "No coach account exists yet. Create one above." };

  try {
    const signInCode = await resetMemberAccess(coach.id, coach.id);
    const parsed = parseSignInCode(signInCode)!;
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({
      email: memberAuthEmail(parsed.memberCode, publicEnv.memberEmailDomain()),
      password: parsed.accessKey,
    });
    return { status: "success", signInCode, displayName: coach.display_name };
  } catch (err) {
    console.error("recoverAdmin failed", err);
    return { status: "error", message: "Couldn't issue a new code. Try again." };
  }
}
