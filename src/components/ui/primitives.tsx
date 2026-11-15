import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { brand } from "@/config/brand";

export function Card({ className, hero, ...rest }: ComponentProps<"div"> & { hero?: boolean }) {
  return (
    <div
      className={cn(
        "bg-charcoal border border-line",
        hero ? "rounded-hero p-[18px]" : "rounded-card p-4",
        className,
      )}
      {...rest}
    />
  );
}

export function Eyebrow({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("text-[11px] font-semibold uppercase tracking-eyebrow text-ash", className)}
      {...rest}
    />
  );
}

export function Display({
  as: Tag = "h1",
  size = "h1",
  className,
  ...rest
}: ComponentProps<"h1"> & { as?: "h1" | "h2" | "h3"; size?: "hero" | "display" | "h1" | "h2" }) {
  const sizes = {
    hero: "text-[52px]",
    display: "text-[42px]",
    h1: "text-[32px]",
    h2: "text-[19px] tracking-[0.04em]",
  } as const;
  // Applied after any caller size: tailwind-merge drops a line-height that
  // precedes a font-size class, which would leave serif headings double-spaced.
  const leading = { hero: "leading-[0.98]", display: "leading-[1.02]", h1: "leading-[1.08]", h2: "leading-tight" } as const;
  const callerSetsLeading = /(^|\s)leading-/.test(className ?? "");
  return (
    <Tag
      className={cn("m-0 font-brand font-bold uppercase tracking-[0.01em]", sizes[size], className, !callerSetsLeading && leading[size])}
      {...rest}
    />
  );
}

export type BadgeTone = "accent" | "accentSolid" | "neutral" | "inverse" | "warn" | "info" | "strength";

export function Badge({ tone = "neutral", className, ...rest }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    accent: "bg-accent/14 text-accent",
    accentSolid: "bg-accent text-accent-ink",
    neutral: "bg-graphite text-fog",
    inverse: "bg-chalk text-matte",
    warn: "bg-conditioning/14 text-conditioning",
    info: "bg-hyrox/14 text-hyrox",
    strength: "bg-strength/14 text-strength",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/** Framed "26" — the approved app-icon mark, in miniature. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex flex-none items-center justify-center bg-matte font-brand font-bold text-chalk", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        fontSize: size * 0.46,
        letterSpacing: "-0.02em",
        boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.03)}px var(--color-chalk), inset 0 0 0 ${Math.max(2, size * 0.075)}px var(--color-matte), inset 0 0 0 ${Math.max(2.5, size * 0.09)}px var(--color-chalk)`,
      }}
    >
      {brand.mark}
    </div>
  );
}

/** Compact header lockup: framed 26 + THE TWO SIX CLUB. */
export function Wordmark({ size = 34, sub }: { size?: number; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-none">
        <div className="font-brand text-[9px] font-semibold tracking-[0.34em] text-mist">THE</div>
        <div className="whitespace-nowrap font-brand text-[17px] font-bold tracking-[0.06em]">TWO SIX CLUB</div>
        {sub ? <div className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-ash">{sub}</div> : null}
      </div>
      <span className="sr-only">{brand.name}</span>
    </div>
  );
}

/** Full plaque-style lockup (vector), for the welcome and setup screens. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed
    <img src="/brand/wordmark.svg" alt={`${brand.name}, established ${brand.established}`} width={1200} height={800} className={cn("h-auto w-full", className)} />
  );
}

export function Avatar({ name, size = 36, tone = "neutral" }: { name: string; size?: number; tone?: "neutral" | "accent" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        tone === "accent" ? "bg-accent text-accent-ink" : "bg-graphite text-fog",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size / 3) }}
    >
      {initials || "?"}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline px-5 py-8 text-center">
      <div className="text-[15px] font-bold">{title}</div>
      {children ? <div className="max-w-xs text-sm leading-relaxed text-mist">{children}</div> : null}
      {action}
    </div>
  );
}

export function ProgressBar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "warn" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" role="presentation">
      <div
        className={cn("h-full rounded-full", tone === "warn" ? "bg-conditioning" : "bg-accent")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
