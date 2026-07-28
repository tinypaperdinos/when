import {
  Children,
  isValidElement,
  useId,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import { ChevronDownIcon } from "./chevron-down-icon";

export interface SelectProps {
  children: ReactNode; // <option value="…">Label</option> elements only — see
  // components/ui/README.md and tickets/select-datepicker-refactor/plan.md §2.2
  value?: string; // controlled
  defaultValue?: string; // uncontrolled seed — see plan §2.6
  onChange?: (value: string) => void; // plain string, not a ChangeEvent — see plan §2.3
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string; // kept for API-compat / label association; currently a pure no-op —
  // this codebase's forms submit via controlled onSubmit handlers reading React state,
  // never native FormData/form-native submission, so there's no form-participation
  // logic mirroring this value internally. Forwarded onto the trigger <button> (a
  // button's `name` only ever matters for native form submission, which this codebase
  // doesn't use) so the prop isn't silently dropped.
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

interface OptionElementProps {
  value: string;
  disabled?: boolean;
  children?: ReactNode;
}

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
}

function isOptionElement(node: ReactNode): node is ReactElement<OptionElementProps> {
  return isValidElement(node) && node.type === "option";
}

// Module-private — not exported. Walks `children` looking for plain <option> elements
// only; any other child type is silently skipped (unsupported, not an error — see plan
// §2.2). An <option> whose own children isn't a plain string throws: that's a genuine
// misuse of the supported API, not a case to silently coerce into "[object Object]".
function deriveOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children)
    .filter(isOptionElement)
    .map((element) => {
      const { value, disabled = false, children: label } = element.props;
      if (typeof label !== "string") {
        throw new Error(
          `Select: <option value="${value}"> must have a plain string label as its own children.`,
        );
      }
      return { value, disabled, label };
    });
}

// Direction to search in when skipping disabled options during highlight movement.
type Direction = 1 | -1;

function nextEnabledIndex(
  options: SelectOption[],
  from: number,
  direction: Direction,
): number | null {
  let i = from;
  while (i >= 0 && i < options.length) {
    if (!options[i].disabled) return i;
    i += direction;
  }
  return null;
}

// Hand-rolled, keyboard-accessible listbox/combobox — no native <select> is rendered.
// Reuses the ARIA-combobox-listbox pattern already established in tag-input.tsx: the
// trigger button keeps real DOM focus for the entire open/interact/close lifecycle,
// popup content is navigated via `aria-activedescendant` rather than `element.focus()`
// calls, and the popup's blur+`onMouseDown preventDefault()` mechanics suppress the
// focus-shift-before-click race. See tickets/select-datepicker-refactor/plan.md §2.7/§3.1.
//
// Stays controlled-or-uncontrolled (plan §2.6) — a single scalar string value, unlike
// the composite, controlled-only family (DateTimePicker/DateRangePicker/TagInput)
// documented in components/ui/README.md.
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  required,
  name,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectProps) {
  const options = deriveOptions(children);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const listboxId = useId();

  const currentValue = value !== undefined ? value : internalValue;
  const selectedOption = options.find((option) => option.value === currentValue);

  function openPopup(direction: Direction = 1) {
    const selectedIndex = options.findIndex((option) => option.value === currentValue);
    const start = selectedIndex >= 0 ? selectedIndex : direction === 1 ? 0 : options.length - 1;
    const initial =
      start >= 0 && start < options.length && !options[start].disabled
        ? start
        : nextEnabledIndex(options, start, direction) ??
          nextEnabledIndex(options, start, direction === 1 ? -1 : 1);
    setOpen(true);
    setHighlightedIndex(initial);
  }

  function closePopup() {
    setOpen(false);
    setHighlightedIndex(null);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (value === undefined) setInternalValue(option.value);
    onChange?.(option.value);
    closePopup();
  }

  function moveHighlight(direction: Direction) {
    if (options.length === 0) return;
    if (!open) {
      openPopup(direction);
      return;
    }
    setHighlightedIndex((prev) => {
      const from = prev === null ? (direction === 1 ? -1 : options.length) : prev + direction;
      return nextEnabledIndex(options, from, direction) ?? prev;
    });
  }

  function handleTriggerClick() {
    if (disabled) return;
    if (open) {
      closePopup();
    } else {
      openPopup();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) {
        if (highlightedIndex !== null) commit(highlightedIndex);
        else closePopup();
      } else {
        openPopup();
      }
      return;
    }

    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        closePopup();
      }
      return;
    }
  }

  const classes = cn(
    "field-base",
    "flex items-center justify-between gap-2 px-3 py-2 text-base text-left",
    className,
  );

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        name={name}
        className={classes}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={
          open && highlightedIndex !== null ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        onBlur={closePopup}
      >
        <span className={cn("truncate", !selectedOption && "text-ink/40")}>
          {selectedOption ? selectedOption.label : (placeholder ?? "")}
        </span>
        <ChevronDownIcon className="size-4 shrink-0" />
      </button>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full rounded-sm border-2 border-ink bg-paper shadow-hard"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={option.value === currentValue}
              aria-disabled={option.disabled || undefined}
              className={cn(
                "px-3 py-1.5 text-sm",
                option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                index === highlightedIndex && "bg-accent text-paper",
              )}
              // Load-bearing, not decorative — same mousedown-before-blur race as
              // tag-input.tsx's suggestion buttons: preventDefault() here stops the
              // trigger's onBlur from closing the popup before this option's onClick
              // fires. See tag-input.tsx's onMouseDown comment for the full explanation.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
