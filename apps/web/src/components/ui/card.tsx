import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type CardPadding = "sm" | "md";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

const baseClasses = "rounded-sm border-2 border-ink bg-paper shadow-hard";

const paddingClasses: Record<CardPadding, string> = {
  sm: "p-3",
  md: "p-4",
};

export function Card({ padding = "md", className, ...props }: CardProps) {
  const classes = cn(baseClasses, paddingClasses[padding], className);

  return <div className={classes} {...props} />;
}
