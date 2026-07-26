// Shared, size-independent field-well styling used by TextInput, Textarea, and Select
// (see components/ui/README.md and tickets/form-primitives/plan.md §2.5). Deliberately
// contains no padding/text-size classes — each consumer supplies its own complete,
// non-overlapping padding/text-size classes at the call site (mirroring how
// button.tsx/card.tsx/panel.tsx keep size classes exclusive in their own variant maps),
// so no two utilities targeting the same CSS property are ever present on one element at
// once. Not a component — no *HTMLAttributes export, nothing to instantiate or render —
// so it has no colocated test file; its correctness is exercised transitively by the
// three consuming components' own tests.
export const fieldBaseClasses =
  "w-full rounded-sm border-2 border-ink bg-paper " +
  "shadow-input outline-none placeholder:text-ink/40 " +
  "focus-visible:outline-dashed focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-line/10";
