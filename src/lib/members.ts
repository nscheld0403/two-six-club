import "server-only";
import { createHash } from "node:crypto";
import {
  formatSignInCode,
  generateAccessKey,
  generateMemberCode,
  memberAuthEmail,
} from "@/lib/credentials";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RegistrationInput } from "@/lib/validation";

const MAX_REGISTRATIONS_PER_HOUR = 5;

export function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "two-six-club";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Returns false when this client has registered too many times recently. */
export async function allowRegistrationAttempt(ip: string): Promise<boolean> {
  const admin = createAdminClient();
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("registration_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (error) throw error;
  if ((count ?? 0) >= MAX_REGISTRATIONS_PER_HOUR) return false;
  const { error: insertError } = await admin.from("registration_attempts").insert({ ip_hash: ipHash });
  if (insertError) throw insertError;
  return true;
}

export type CreatedMember = { userId: string; memberCode: string; accessKey: string; signInCode: string; email: string };

/**
 * Creates the Supabase Auth user and the pending profile. The access key is
 * returned exactly once so it can be shown to the member; it is not stored.
 */
export async function createMember(
  input: RegistrationInput,
  opts: { role?: "member" | "admin"; status?: "pending" | "active" } = {},
): Promise<CreatedMember> {
  const admin = createAdminClient();
  const domain = publicEnv.memberEmailDomain();

  for (let attempt = 0; attempt < 5; attempt++) {
    const memberCode = generateMemberCode();
    const accessKey = generateAccessKey();
    const email = memberAuthEmail(memberCode, domain);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: accessKey,
      email_confirm: true,
      app_metadata: { member_code: memberCode },
    });
    if (error) {
      // Member code collision: try another one.
      if (/already|exists|registered/i.test(error.message)) continue;
      throw error;
    }

    const userId = data.user.id;
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      member_code: memberCode,
      display_name: input.displayName,
      age: input.age,
      sex: input.sex,
      role: opts.role ?? "member",
      status: opts.status ?? "pending",
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      if (profileError.code === "23505") continue; // unique violation on member_code
      throw profileError;
    }

    return { userId, memberCode, accessKey, signInCode: formatSignInCode(memberCode, accessKey), email };
  }
  throw new Error("Could not allocate a unique member code. Please try again.");
}

/** Issues a new access key, signs the member out everywhere, and logs it. */
export async function resetMemberAccess(memberId: string, actorId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("member_code")
    .eq("id", memberId)
    .single();
  if (error || !profile) throw error ?? new Error("Member not found");

  const accessKey = generateAccessKey();
  const { error: updateError } = await admin.auth.admin.updateUserById(memberId, { password: accessKey });
  if (updateError) throw updateError;

  await admin.rpc("revoke_member_sessions", { target: memberId });
  await admin.from("profiles").update({ access_reset_at: new Date().toISOString() }).eq("id", memberId);
  await admin.from("audit_log").insert({ actor_id: actorId, action: "member.access_reset", target_id: memberId });

  return formatSignInCode(profile.member_code, accessKey);
}

export async function deleteMember(memberId: string, actorId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({ actor_id: actorId, action: "member.deleted", details: { member_id: memberId } });
  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) throw error;
}
