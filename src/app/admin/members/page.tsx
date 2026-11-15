import { Display, Eyebrow } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MembersManager } from "./members-manager";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, member_code, display_name, age, birth_date, sex, role, status, created_at, approved_at, access_reset_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <header>
        <Eyebrow className="text-xs">Approvals, access and details</Eyebrow>
        <Display className="mt-1 text-[48px]">Members</Display>
      </header>
      <MembersManager members={data ?? []} selfId={me.id} />
    </>
  );
}
