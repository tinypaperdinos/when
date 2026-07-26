import type { HTMLAttributes } from "react";

export type CardPadding = "sm" | "md";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

const baseClasses = "rounded-sm border-2 border-ink bg-paper shadow-[3px_3px_0_0_#1e1d1b]";

const paddingClasses: Record<CardPadding, string> = {
  sm: "p-3",
  md: "p-4",
};

export function Card({ padding = "md", className, ...props }: CardProps) {
  const classes = [baseClasses, paddingClasses[padding], className]
    .filter(Boolean)
    .join(" ");

  return <div className={classes} {...props} />;
}
