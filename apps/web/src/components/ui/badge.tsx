import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type BadgeVariant = "pop" | "accent" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const baseClasses =
  "inline-flex items-center gap-1 rounded-sm border-2 border-ink " +
  "px-2 py-1 text-xs font-bold tracking-wide uppercase";

const variantClasses: Record<BadgeVariant, string> = {
  pop: "bg-pop text-paper", // default — matches the explore-branch mockup (README)
  accent: "bg-accent text-paper",
  neutral: "bg-paper text-ink", // outline-style, for a tag shown on a light/busy background
};

// Display-only chip for rendering a single tag's text — a thin `Card`/`Button`-style
// wrapper around a variant-classed <span>, no concept of a tag id or remove behavior of
// its own. `TagInput` composes this with a label and its own remove <button> as
// children; `Badge` stays strictly presentational (issue #17).
export function Badge({ variant = "pop", className, children, ...props }: BadgeProps) {
  const classes = cn(baseClasses, variantClasses[variant], className);

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
