import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type TextInputSize = "sm" | "md";

// `size` is Omit-ted: InputHTMLAttributes already declares a native `size?: number`
// attribute (visible width in characters) that clashes with our `"sm" | "md"` variant.
export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: TextInputSize;
}

// Complete, self-contained, non-overlapping padding/text-size per size — see
// the `.field-base` class in index.css for why this isn't folded into it.
const sizeClasses: Record<TextInputSize, string> = {
  sm: "px-2 py-1 text-sm",
  md: "px-3 py-2 text-base",
};

export function TextInput({ size = "md", className, ...props }: TextInputProps) {
  const classes = cn("field-base", sizeClasses[size], className);

  return <input className={classes} {...props} />;
}
