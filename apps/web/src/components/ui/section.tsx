import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
}

const baseClasses = "space-y-3";

export function Section({ title, actions, className, children, ...props }: SectionProps) {
  const headingId = useId();
  const hasHeader = Boolean(title || actions);
  const classes = cn(baseClasses, className);

  return (
    <section
      className={classes}
      aria-labelledby={title ? headingId : undefined}
      {...props}
    >
      {hasHeader && (
        <div className="flex items-center justify-between">
          {title && (
            <h2 id={headingId} className="text-lg font-medium">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
