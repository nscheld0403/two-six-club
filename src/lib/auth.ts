import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/database.types";

/** The signed-in member's profile, verified against Supabase Auth. Cached per request. */
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data ?? null;
});

export async function requireSignedIn(): Promise<ProfileRow> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/welcome");
  return profile;
}

export async function requireActiveMember(): Promise<ProfileRow> {
  const profile = await requireSignedIn();
  if (profile.status !== "active") redirect("/pending");
  return profile;
}

export async function requireAdmin(): Promise<ProfileRow> {
  const profile = await requireActiveMember();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
