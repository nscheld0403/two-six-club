"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RsvpStatus } from "@/lib/supabase/database.types";

const input = z.object({ sessionId: z.uuid(), status: z.enum(["going", "maybe", "not_going"]) });

export type RsvpResult = { ok: true } | { ok: false; message: string };

export async function setRsvp(sessionId: string, status: RsvpStatus): Promise<RsvpResult> {
  const me = await requireActiveMember();
  const parsed = input.safeParse({ sessionId, status });
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .upsert({ session_id: parsed.data.sessionId, member_id: me.id, status: parsed.data.status }, { onConflict: "session_id,member_id" });

  if (error) {
    if (error.code === "23P01") return { ok: false, message: "This class is full. Mark yourself as Maybe to hear if a spot opens." };
    if (error.code === "22023") return { ok: false, message: error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
    console.error("setRsvp failed", error);
    return { ok: false, message: "Couldn't save your RSVP. Try again." };
  }
  revalidatePath("/schedule");
  revalidatePath("/");
  return { ok: true };
}

export async function getAttendees(sessionId: string) {
  await requireActiveMember();
  const id = z.uuid().safeParse(sessionId);
  if (!id.success) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("session_attendees", { p_session: id.data });
  return (data ?? []).map((a) => ({ name: a.display_name, status: a.status, birthday: a.is_birthday }));
}
