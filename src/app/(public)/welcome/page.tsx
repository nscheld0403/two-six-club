import { brand } from "@/config/brand";
import { ButtonLink } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/primitives";

export const metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <main className="flex flex-1 flex-col px-6 pb-9 pt-14" style={{ paddingTop: "max(56px, env(safe-area-inset-top))" }}>
      <div className="mx-auto mt-6 w-full max-w-[300px]">
        <BrandLockup />
      </div>
      <p className="m-0 mt-8 text-center font-brand text-[13px] font-semibold tracking-[0.32em] text-chalk">
        PRIVATE TRAINING CLUB
      </p>
      <ul className="m-0 mt-4 flex list-none flex-wrap justify-center gap-2 p-0" aria-label="Disciplines">
        {brand.disciplines.map((d) => (
          <li key={d} className="flex h-7 items-center rounded-full border border-hairline px-3 text-xs font-semibold text-mist">
            {d}
          </li>
        ))}
      </ul>
      <p className="mx-2 mb-0 mt-5 text-center text-[15px] leading-normal text-mist">{brand.tagline}</p>
      <div className="min-h-8 flex-1" />
      <div className="flex flex-col gap-2.5">
        <ButtonLink href="/join" size="lg">
          Request to join
        </ButtonLink>
        <ButtonLink href="/sign-in" size="lg" variant="ghost" className="border border-chalk text-chalk font-semibold">
          I have a sign-in code
        </ButtonLink>
      </div>
    </main>
  );
}
