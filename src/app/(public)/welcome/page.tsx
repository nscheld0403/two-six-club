import { brand } from "@/config/brand";
import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/primitives";

export const metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 pb-9 pt-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-24 font-display text-[420px] font-extrabold leading-[0.8] tracking-[-0.02em] text-charcoal select-none"
      >
        {brand.mark}
      </div>
      <div className="relative">
        <Wordmark size={36} />
      </div>
      <div className="flex-1" />
      <div className="relative flex flex-col gap-[18px]">
        <ul className="flex flex-wrap gap-2" aria-label="Disciplines">
          {brand.disciplines.map((d) => (
            <li
              key={d}
              className="flex h-7 items-center rounded-full border border-hairline px-3 text-xs font-semibold text-fog"
            >
              {d}
            </li>
          ))}
        </ul>
        <h1 className="m-0 font-display text-[76px] font-extrabold uppercase leading-[0.86]">
          Train
          <br />
          with your
          <br />
          <span className="text-accent">people.</span>
        </h1>
        <p className="m-0 text-base leading-normal text-mist">{brand.tagline}</p>
        <div className="mt-2 flex flex-col gap-2.5">
          <ButtonLink href="/join" size="lg">
            Request to join
          </ButtonLink>
          <ButtonLink href="/sign-in" size="lg" variant="secondary">
            I have a sign-in code
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
