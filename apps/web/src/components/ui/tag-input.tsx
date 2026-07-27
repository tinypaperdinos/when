import { useId, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { Badge } from "./badge";
import { TextInput } from "./text-input";

export interface TagInputProps {
  value: string[]; // currently selected tags, in the order added
  onChange: (value: string[]) => void;
  suggestions?: string[]; // candidate tags to autocomplete against — plain, caller-
  // supplied array; TagInput does no fetching/debouncing of its own (component-library
  // primitive, no live data source — see tickets/tag-input-badge/plan.md §2.3)
  placeholder?: string; // default "Add a tag…"
  label?: string; // default "Tags" — aria-label for the text field
  disabled?: boolean;
  className?: string; // applied to the outer wrapping <div>
}

const MAX_SUGGESTIONS = 8; // not a prop — no consumer need identified yet

// Controlled-only composite (value/onChange always required, no defaultValue) built out
// of TextInput + Badge, plus a hand-rolled ARIA-combobox listbox — joins
// DateTimePicker/DateRangePicker in components/ui/README.md's "composite,
// controlled-only components" category, since this has its own derived UI state (draft
// text, dropdown open/closed, keyboard-highlighted suggestion) rather than being a thin
// wrapper around one native element.
export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
  disabled,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const listboxId = useId();

  const filtered =
    draft.trim() === ""
      ? []
      : (suggestions ?? [])
          .filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()))
          .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS);

  function commitTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed === "") return;
    const alreadySelected = value.some((v) => v.toLowerCase() === trimmed.toLowerCase());
    if (!alreadySelected) onChange([...value, trimmed]);
    setDraft("");
    setOpen(false);
    setHighlightedIndex(null);
  }

  function recomputeOpen(nextDraft: string) {
    if (nextDraft.trim() === "") {
      setOpen(false);
      return;
    }
    const nextFiltered = (suggestions ?? [])
      .filter((s) => s.toLowerCase().includes(nextDraft.trim().toLowerCase()))
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    setOpen(nextFiltered.length > 0);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const next = e.target.value;
    setDraft(next);
    setHighlightedIndex(null);
    recomputeOpen(next);
  }

  function handleFocus() {
    if (disabled) return;
    recomputeOpen(draft);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      if (filtered.length > 0) {
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex((prev) =>
          prev === null ? 0 : Math.min(prev + 1, filtered.length - 1),
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      if (filtered.length > 0) {
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex((prev) => (prev === null ? 0 : Math.max(prev - 1, 0)));
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex !== null && filtered[highlightedIndex] !== undefined) {
        commitTag(filtered[highlightedIndex]);
      } else if (draft.trim() !== "") {
        commitTag(draft);
      }
      return;
    }

    if (e.key === "Escape") {
      if (open) {
        setOpen(false);
        setHighlightedIndex(null);
      }
      return;
    }

    if (e.key === "Backspace") {
      if (draft === "" && value.length > 0) {
        onChange(value.slice(0, -1));
      }
      return;
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} className="gap-1.5">
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v !== tag))}
                className="leading-none disabled:cursor-not-allowed"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <TextInput
          role="combobox"
          aria-label={label ?? "Tags"}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            highlightedIndex !== null ? `${listboxId}-option-${highlightedIndex}` : undefined
          }
          placeholder={placeholder ?? "Add a tag…"}
          value={draft}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setOpen(false)}
        />
        {open && filtered.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 w-full rounded-sm border-2 border-ink bg-paper shadow-hard"
          >
            {filtered.map((suggestion, i) => (
              <li
                key={suggestion}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === highlightedIndex}
              >
                <button
                  type="button"
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-sm",
                    i === highlightedIndex && "bg-accent text-paper",
                  )}
                  // Load-bearing, not decorative: suppresses the mousedown-triggered blur
                  // on the TextInput (so onBlur doesn't close the dropdown before the
                  // click that selects the suggestion lands) *and*, from that same
                  // preventDefault() call, cancels the browser's default mousedown
                  // behavior of shifting focus to this button — so the input never loses
                  // focus during the click. Standard combobox pattern. Note: this repo's
                  // fireEvent-only test convention can't simulate the real browser
                  // mousedown->focus-shift->blur chain in jsdom, so the regression test
                  // for this handler asserts the lower-level, directly-checkable fact
                  // that preventDefault() was actually called (fireEvent's return value),
                  // not the higher-level focus-retention behavior — see tag-input.test.tsx.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitTag(suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
