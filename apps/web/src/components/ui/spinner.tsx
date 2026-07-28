import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type SpinnerSize = "sm" | "md";

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
}

const containerSizeClasses: Record<SpinnerSize, string> = {
  sm: "size-6",
  md: "size-8",
};

const squareSizeClasses: Record<SpinnerSize, string> = {
  sm: "size-2",
  md: "size-2.5",
};

// The "spin" is implied by phase offset between the 4 squares, not motion.
const DELAYS = ["0ms", "-300ms", "-600ms", "-900ms"];
const POSITIONS = ["top-0 left-0", "top-0 right-0", "right-0 bottom-0", "bottom-0 left-0"];

// Purely decorative — always aria-hidden. LoadingState wraps this with the accessible
// role="status" surface.
export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  return (
    <div className={cn("relative", containerSizeClasses[size], className)} {...props} aria-hidden="true">
      {POSITIONS.map((position, i) => (
        <span
          key={position}
          className={cn(
            "absolute animate-square-pulse bg-accent motion-reduce:animate-none",
            squareSizeClasses[size],
            position,
          )}
          style={{ animationDelay: DELAYS[i] }}
        />
      ))}
    </div>
  );
}
