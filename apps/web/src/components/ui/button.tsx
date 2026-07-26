import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// `icon` is icon-only (no visible text) — consumers MUST supply `aria-label` (or
// `aria-labelledby`) so the button has an accessible name. Not type-enforced (see
// tickets/form-primitives/plan.md §3.1); every usage in this codebase must model it.
export type ButtonVariant = "primary" | "secondary" | "icon";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses =
  "inline-flex items-center justify-center rounded-sm border-2 font-medium " +
  "shadow-hard transition-transform duration-100 ease-out " +
  "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none " +
  "focus-visible:outline-none focus-visible:outline-dashed focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none " +
  "disabled:active:translate-x-0 disabled:active:translate-y-0";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-paper border-ink hover:bg-accent-dark",
  secondary: "bg-paper text-ink border-ink hover:bg-line/30",
  // Shape-only variant (square, no visible text) — reuses secondary's color treatment
  // rather than introducing a new palette. See tickets/form-primitives/plan.md §3.1.
  icon: "bg-paper text-ink border-ink hover:bg-line/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: "p-1.5",
  md: "p-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const classes = cn(
    baseClasses,
    variantClasses[variant],
    variant === "icon" ? iconSizeClasses[size] : sizeClasses[size],
    className,
  );

  return <button className={classes} {...props} />;
}
