import { Display, EmptyState, Eyebrow } from "@/components/ui/primitives";

/** Honest placeholder for screens built in later phases. Never shows sample data. */
export function ComingSoon({ eyebrow, title, message }: { eyebrow: string; title: string; message: string }) {
  return (
    <>
      <section className="flex flex-col gap-1 pt-1">
        <Eyebrow className="text-xs">{eyebrow}</Eyebrow>
        <Display>{title}</Display>
      </section>
      <EmptyState title="Nothing here yet">{message}</EmptyState>
    </>
  );
}
