import { signOut } from "@/app/(public)/actions";
import { LogoutIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, Display, Eyebrow } from "@/components/ui/primitives";
import { requireActiveMember } from "@/lib/auth";
import { AccountForm } from "./account-form";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireActiveMember();
  const since = new Date(me.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <>
      <section className="flex flex-col gap-1 pt-1">
        <Eyebrow className="text-xs">Member since {since}</Eyebrow>
        <Display>My account</Display>
      </section>

      <AccountForm
        profile={{
          displayName: me.display_name,
          birthDate: me.birth_date ?? "",
          sex: me.sex,
          resultsVisible: me.results_visible,
          showDemographics: me.show_demographics,
        }}
      />

      <Card className="flex flex-col gap-2">
        <Eyebrow>Member code</Eyebrow>
        <div className="font-mono text-xl font-semibold tracking-[0.08em]">{me.member_code}</div>
        <p className="m-0 text-[13px] leading-relaxed text-mist">
          This is the first part of your sign-in code. The rest is secret and was only shown once. If you lose it,
          ask the coach to reset your access.
        </p>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          <LogoutIcon size={18} /> Sign out on this device
        </Button>
      </form>
    </>
  );
}
