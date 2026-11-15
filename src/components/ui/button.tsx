import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "inverse" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "lg" | "md" | "sm" | "pill";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink font-bold",
  inverse: "bg-chalk text-matte font-bold",
  secondary: "bg-charcoal border border-hairline text-chalk font-semibold hover:border-edge",
  ghost: "text-accent font-semibold",
  danger: "border border-hairline text-conditioning font-semibold hover:border-conditioning/50",
  soft: "bg-accent/14 text-accent font-bold",
};

const sizes: Record<ButtonSize, string> = {
  lg: "h-14 px-6 rounded-[16px] text-base",
  md: "h-12 px-5 rounded-button text-[15px]",
  sm: "h-11 px-4 rounded-button text-sm",
  pill: "h-11 px-4 rounded-full text-sm",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "press inline-flex items-center justify-center gap-2 select-none whitespace-nowrap",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />;
}
