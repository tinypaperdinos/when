import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  const classes = cn("field-base", "px-3 py-2 text-base min-h-24 resize-y", className);

  return <textarea className={classes} {...props} />;
}
