import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { ChevronDownIcon } from "./chevron-down-icon";

// `multiple` is Omit-ted: the custom chevron/appearance-none styling assumes a
// single-line, single-value select — a native multi-select listbox renders as multiple
// visible rows and would collide with the absolutely-positioned chevron.
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple"> {
  placeholder?: string;
}

export function Select({ placeholder, className, children, ...props }: SelectProps) {
  const classes = cn(
    "field-base",
    "px-3 py-2 text-base appearance-none pr-8",
    className,
  );

  // React manages a <select>'s selected option via the select's own value/defaultValue
  // prop, not via an <option>'s `selected` attribute (setting `selected` directly on the
  // <option> triggers a React dev warning: "Use the `defaultValue` or `value` props on
  // <select> instead of setting `selected` on <option>"). So when a placeholder is given
  // and the consumer hasn't supplied their own value/defaultValue, default the select's
  // own defaultValue to "" to make the placeholder option the initially-selected one —
  // consumer-supplied value/defaultValue (spread below) still wins if present.
  // TODO(#26): revisit this whole check — if we instead required consumers to always
  // pass their own value/defaultValue alongside `placeholder`, this fallback could be
  // dropped entirely.
  const defaultValue =
    placeholder !== undefined && props.value === undefined && props.defaultValue === undefined
      ? ""
      : undefined;

  return (
    <div className="relative">
      <select className={classes} defaultValue={defaultValue} {...props}>
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute inset-y-0 right-2 my-auto size-4" />
    </div>
  );
}
