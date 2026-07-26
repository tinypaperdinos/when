import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

// `type` is Omit-ted and hardcoded to "checkbox" internally — this component is a
// checkbox, so a conflicting `type` doesn't make sense.
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export function Checkbox({ label, className, disabled, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 select-none",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="relative inline-flex size-5 shrink-0">
        <input
          type="checkbox"
          disabled={disabled}
          className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-sm border-2 border-ink bg-paper",
            "transition-colors peer-checked:bg-accent",
            "peer-focus-visible:outline peer-focus-visible:outline-dashed",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
            "peer-focus-visible:outline-accent",
          )}
        />
        <svg
          className="pointer-events-none absolute inset-0 m-auto size-3 opacity-0 peer-checked:opacity-100"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 12.5l5 5L20 6"
            stroke="var(--color-paper)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
