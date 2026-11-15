import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { isBirthdayOn } from "@/lib/birthday";
import { dateKeyIn, formatDateKey, formatTime } from "@/lib/time";
import { Roster } from "./roster";

export const metadata = { title: "Roster" };

export default async function RosterPage({ params }: PageProps<"/admin/schedule/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { timeZone } = await getClubSettings();
  const { data: session } = await supabase.from("class_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) notFound();
  const [{ data: reservations }, { data: members }] = await Promise.all([
    supabase.from("reservations").select("*").eq("session_id", id),
    supabase.from("profiles").select("id, display_name, member_code, birth_date").eq("status", "active").order("display_name"),
  ]);
  const day = dateKeyIn(new Date(session.starts_at), timeZone);

  return (
    <Roster
      session={{
        id: session.id,
        title: session.title,
        capacity: session.capacity,
        when: `${formatDateKey(day, { weekday: "long", month: "long", day: "numeric" })} · ${formatTime(session.starts_at, timeZone).label}`,
        week: day,
        cancelled: session.status === "cancelled",
      }}
      reservations={(reservations ?? []).map((r) => ({
        memberId: r.member_id,
        name: members?.find((m) => m.id === r.member_id)?.display_name ?? "Former member",
        birthday: isBirthdayOn(members?.find((m) => m.id === r.member_id)?.birth_date, day),
        status: r.status,
        attended: r.attended,
      }))}
      members={(members ?? []).map((m) => ({ id: m.id, name: m.display_name, code: m.member_code }))}
    />
  );
}
