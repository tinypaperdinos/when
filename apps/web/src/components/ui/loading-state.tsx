import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Spinner, type SpinnerSize } from "./spinner";

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode; // default "Loading…"
  size?: SpinnerSize; // forwarded to Spinner, default "md"
}

// Accessible surface around Spinner: role="status" + aria-live="polite", wrapping the
// (aria-hidden) Spinner and a visible label that doubles as the live region's announced
// text — no separate visually-hidden text needed, the label is always rendered.
export function LoadingState({
  label = "Loading…",
  size = "md",
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-2 py-8 text-sm text-ink/60", className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Spinner size={size} />
      <span>{label}</span>
    </div>
  );
}
