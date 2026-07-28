import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  title: ReactNode; // required — an empty state without a headline isn't meaningful
  description?: ReactNode;
  action?: ReactNode; // e.g. a <Button>
}

// Strictly presentational — no isEmpty/data prop, no knowledge of *why* something is
// empty; the consumer still owns that condition (matches Badge's precedent, issue #17).
// Reuses Panel's role="region" + aria-labelledby landmark pattern, applied
// unconditionally since title is required here (unlike Panel, where it's optional).
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const headingId = useId();

  return (
    <div
      className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}
      role="region"
      aria-labelledby={headingId}
      {...props}
    >
      {icon && <div aria-hidden="true">{icon}</div>}
      <h3 id={headingId} className="text-lg font-medium">
        {title}
      </h3>
      {description && <p className="text-sm text-ink/60">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
