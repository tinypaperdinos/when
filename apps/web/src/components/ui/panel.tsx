import { useId, type HTMLAttributes, type ReactNode } from "react";

export type PanelPadding = "md" | "lg";

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  padding?: PanelPadding;
}

const baseClasses = "rounded-sm border-2 border-ink bg-paper shadow-[3px_3px_0_0_#1e1d1b]";

const paddingClasses: Record<PanelPadding, string> = {
  md: "p-4",
  lg: "p-6",
};

export function Panel({
  title,
  description,
  padding = "lg",
  className,
  children,
  ...props
}: PanelProps) {
  const headingId = useId();
  const hasHeader = Boolean(title || description);
  const classes = [baseClasses, paddingClasses[padding], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role={title ? "region" : undefined}
      aria-labelledby={title ? headingId : undefined}
      {...props}
    >
      {hasHeader && (
        <div className="space-y-1 border-b-2 border-line pb-3">
          {title && (
            <h3 id={headingId} className="text-lg font-medium">
              {title}
            </h3>
          )}
          {description && <p className="text-sm text-ink/60">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
