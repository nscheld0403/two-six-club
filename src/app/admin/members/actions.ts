"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { deleteMember, resetMemberAccess } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import type { MemberStatus } from "@/lib/supabase/database.types";
import { profileUpdateSchema } from "@/lib/validation";

const id = z.uuid();

export type ActionResult = { ok: true; message?: string; signInCode?: string } | { ok: false; message: string };

/** Status changes run through the admin's own session, so RLS + triggers enforce them too. */
async function setStatus(memberId: string, status: MemberStatus): Promise<ActionResult> {
  const me = await requireAdmin();
  const target = id.parse(memberId);
  if (target === me.id) return { ok: false, message: "You can't change your own membership status." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", target);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function approveMember(memberId: string) {
  return setStatus(memberId, "active");
}
export async function declineMember(memberId: string) {
  return setStatus(memberId, "declined");
}
export async function suspendMember(memberId: string) {
  return setStatus(memberId, "suspended");
}
export async function reactivateMember(memberId: string) {
  return setStatus(memberId, "active");
}

export async function resetAccess(memberId: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const target = id.parse(memberId);
  try {
    const signInCode = await resetMemberAccess(target, me.id);
    revalidatePath("/admin", "layout");
    return { ok: true, signInCode };
  } catch (err) {
    console.error("resetAccess failed", err);
    return { ok: false, message: "Couldn't reset access. Try again." };
  }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const target = id.parse(memberId);
  if (target === me.id) return { ok: false, message: "You can't delete your own account." };
  try {
    await deleteMember(target, me.id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    console.error("removeMember failed", err);
    return { ok: false, message: "Couldn't delete this member." };
  }
}

export async function updateMemberDetails(memberId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const target = id.parse(memberId);
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    age: formData.get("age"),
    sex: formData.get("sex"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid details" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, age: parsed.data.age, sex: parsed.data.sex })
    .eq("id", target);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved" };
}
