import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// NOTE for issue #15 ("Component library: form primitives"): this is the real,
// permanent Button, not a throwaway proof-of-concept — extend this file in place with
// an `icon`/icon-only variant (and whatever else #15's scoping needs) rather than
// deleting and rebuilding it. See tickets/component-library-setup/plan.md §3.3 for the
// full reasoning.

export type ButtonVariant = "primary" | "secondary";
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
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);

  return <button className={classes} {...props} />;
}
