# Review notes (tests): tag-input-badge

## reviewer-tests — round 1

Reviewed `git show 90e0162` (the `feat/tag-input-badge` commit, PR #36) against
`plan.md` §4's edge-case list and `ticket.md`/issue #17's requirements. Read
`badge.tsx`/`badge.test.tsx`, `tag-input.tsx`/`tag-input.test.tsx`, and the
`ui-demo-page.tsx`/`.test.tsx` diff in full. Ran the actual suite
(`npx vitest run src/components/ui/tag-input.test.tsx src/components/ui/badge.test.tsx`
from `apps/web`) — 33/33 pass.

### Verified claim: the `onMouseDown`/`preventDefault` regression test

This was the one thing flagged for independent verification, since `refiner-notes.md`
round 2 explicitly found the plan's originally-specified test (assert
`document.activeElement` is still the input after a suggestion click) would pass
identically whether or not the `onMouseDown={(e) => e.preventDefault()}` handler exists,
because `fireEvent.mouseDown` in jsdom never moves focus or fires `blur` regardless of
`preventDefault()`.

The implementer diverged from the plan's literal §4 wording and instead added:

```ts
it("calls preventDefault() on mousedown for a suggestion button (suppresses the blur-before-click race)", () => {
  ...
  const notPrevented = fireEvent.mouseDown(button);
  expect(notPrevented).toBe(false);
});
```

(`tag-input.test.tsx:204-215`), with a code comment on the `onMouseDown` handler itself
(`tag-input.tsx:189-199`) explaining the reasoning and stating the claim was
mutation-tested (handler deleted, confirmed only this assertion failed, restored).

Independently reproduced this, not trusted at face value:

- Confirmed `fireEvent.mouseDown` (Testing Library) returns the boolean result of
  `element.dispatchEvent(event)`, and `mousedown` is a cancelable `MouseEvent` by
  default, so `dispatchEvent` returns `false` exactly when a handler called
  `preventDefault()` on it — this is a real, DOM-spec-guaranteed distinguishing signal
  `fireEvent` *can* observe, unlike `activeElement`/`blur`.
- Backed up the whole file (`tag-input.tsx` → scratchpad), mechanically deleted the
  `onMouseDown={(e) => e.preventDefault()}` prop from the suggestion `<button>`, and
  reran `tag-input.test.tsx`: **exactly one test failed** — the
  `calls preventDefault() on mousedown...` test (`expected true to be false`) — and the
  other 23 tests in the file, including "clicking a rendered suggestion option commits
  it...", still passed. Restored the original file afterward; `git status` and a rerun
  of the full 33-test pair confirm no diff was left behind.

**This independently confirms the implementer's claim exactly as reported.** The test is
a genuine, mechanism-accurate regression guard for the `preventDefault()` call — not a
mock-checking or tautological test — and it is the *only* test in the file that would
catch that specific regression (the "clicking a suggestion commits it" test at
`tag-input.test.tsx:173-189` calls `fireEvent.mouseDown(button)` immediately before
`fireEvent.click(button)`, but doesn't assert on its return value or on focus, so on its
own it would not have caught the regression). The round-2 refiner's non-blocking
concern is fully resolved by the implementation, and the code comment on the handler
transparently documents why `activeElement`-based verification was rejected — good
traceability back to `refiner-notes.md` round 2's finding.

### Coverage against `plan.md` §4's edge-case list

Went through every bullet in §4 for both `Badge` and `TagInput` against the actual test
files. All are covered, and by tests that assert concrete, distinguishable behavior
(specific `onChange` call args, specific DOM queries returning `null`/present, specific
attribute values) rather than "was called" mock-only assertions:

- `Badge`: children (plain + composite), all three variants' classes plus the
  default-equals-`pop` case, `className` merge, arbitrary attribute spread ,
  render-without-throwing — all present and each asserts real rendered output
  (`className`, `getByText`, `getByRole`), not implementation internals.
- `TagInput`: chip rendering, default-empty state, substring/case-insensitive matching
  with already-selected exclusion, no-match-keeps-listbox-absent, `MAX_SUGGESTIONS`
  clamp, `ArrowDown`/`ArrowUp` clamping (both directions, no wrap), all three `Enter`
  branches (highlighted / freeform-verbatim-casing / empty-no-op), the
  case-insensitive-duplicate-is-a-silent-no-op case, suggestion click, the
  `preventDefault` regression guard (above), `Escape` (closes without clearing draft),
  both `Backspace` branches, mid-list chip removal, the combined `disabled` test,
  `suggestions` omitted (graceful degradation, including that remove-button/Enter still
  work), `className` merge, `label`/`placeholder` overrides with defaults confirmed
  absent, `aria-expanded`/`aria-activedescendant`, two-instance distinct ids, and
  render-without-throwing on minimal props. I count 24 `TagInput` test cases against
  roughly 24 distinct bullets in §4 — a 1:1 match, nothing skipped.
- Demo route (`ui-demo-page.test.tsx`): both new sections assert headings, all three
  `Badge` variant sample texts, and the `TagInput` section is exercised as genuinely
  interactive (types into the seeded example, clicks a suggestion, checks the freeform
  example never renders a listbox, checks the disabled example's remove buttons are
  disabled) — matches the bar set by the existing `DateTimePicker`/`DateRangePicker`
  demo assertions, not just "renders without throwing."

Each of the "would this test fail if the implementation were reverted" spot-checks I ran
by inspection (not exhaustive mutation testing beyond the one requested above) look
sound — e.g. the `Enter`-with-highlighted-suggestion test asserts the exact resulting
array via `toHaveBeenCalledWith`, not just call count; the duplicate-tag test asserts
`onChange` was *not* called while separately confirming the draft/listbox side effects
still happened, which would catch a bug that either wrongly appends a duplicate or wrongly
fails to clear the draft.

### Non-blocking finding: `MAX_SUGGESTIONS` test only checks count, not which 8

`tag-input.test.tsx:54-61` ("more than MAX_SUGGESTIONS (8) matches: only the first 8 are
rendered as options") asserts `getAllByRole("option")).toHaveLength(8)` but never asserts
*which* 8 (e.g. that `aaa-0` is present and `aaa-8` is absent). The implementation uses
`.slice(0, MAX_SUGGESTIONS)`, i.e. genuinely "first 8," but this test would pass equally
if a future edit changed it to `.slice(1, 9)` or any other 8-length window — it only
catches "not slicing" or "wrong count" bugs, not "wrong window" bugs. Low severity: the
plan's own wording ("only the first 8 are rendered") is slightly under-tested, but
getting the count right while getting the window wrong is a narrow, low-impact class of
bug, and the array in the test (`aaa-0`..`aaa-8`) makes such a regression easy to spot in
the demo route/manual QA too. Non-blocking — worth a one-line strengthening
(`expect(screen.queryByRole("option", { name: "aaa-8" })).not.toBeInTheDocument()`) if a
future fix round touches this file anyway, not worth a dedicated fix round on its own.

### No other gaps found

- No test in either file asserts only that a mock "was called" without also checking its
  arguments or an observable DOM consequence — spot-checked every `onChange` assertion
  and every `expect(...).toHaveBeenCalled...` call in `tag-input.test.tsx`.
- Scope: no test reaches into `apps/server` or wires either component to a live
  `tags.*` procedure — correctly matches the plan's "component-library work only, no
  live data source" boundary (§1/§2.3); nothing in the diff attempts to test something
  out of scope.
- `text-input.tsx`/`text-input.test.tsx`: confirmed untouched in `git show 90e0162`
  (not in the file list at all) — matches the plan's round-2 resolution exactly.

VERDICT: APPROVED
