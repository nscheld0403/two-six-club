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
    hero: "text-[76px] leading-[0.86]",
    display: "text-[56px] leading-[0.9]",
    h1: "text-[40px] leading-[0.95]",
    h2: "text-[22px] leading-none tracking-[0.02em] font-bold",
  } as const;
  return (
    <Tag
      className={cn("font-display font-extrabold uppercase m-0", sizes[size], className)}
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

export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center justify-center bg-accent font-display font-extrabold text-accent-ink",
        className,
      )}
      style={{ width: size, height: size, borderRadius: size * 0.27, fontSize: size * 0.56 }}
    >
      {brand.mark}
    </div>
  );
}

export function Wordmark({ size = 34, sub }: { size?: number; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div>
        <div className="font-display text-[21px] font-extrabold leading-none tracking-[0.08em]">
          {brand.wordmark}
        </div>
        {sub ? <div className="mt-0.5 text-[11px] font-semibold tracking-[0.12em] text-ash">{sub}</div> : null}
      </div>
      <span className="sr-only">{brand.name}</span>
    </div>
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
