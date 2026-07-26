import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { fieldBaseClasses } from "./field-base";

export type TextInputSize = "sm" | "md";

// `size` is Omit-ted: InputHTMLAttributes already declares a native `size?: number`
// attribute (visible width in characters) that clashes with our `"sm" | "md"` variant.
export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: TextInputSize;
}

// Complete, self-contained, non-overlapping padding/text-size per size — see
// field-base.ts's doc comment for why this isn't folded into fieldBaseClasses.
const sizeClasses: Record<TextInputSize, string> = {
  sm: "px-2 py-1 text-sm",
  md: "px-3 py-2 text-base",
};

export function TextInput({ size = "md", className, ...props }: TextInputProps) {
  const classes = cn(fieldBaseClasses, sizeClasses[size], className);

  return <input className={classes} {...props} />;
}
