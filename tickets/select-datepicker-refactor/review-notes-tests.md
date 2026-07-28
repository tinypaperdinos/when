# Test review notes — select-datepicker-refactor

## reviewer-tests — round 1

Scope: `git diff main...feat/select-datepicker-refactor` (57d5ee1 Select/Phase A,
7e36b87 calendar popup/Phase B) against `plan.md` §5's edge-case list and
`ticket.md`/issue #30. Full test suite run (`npx vitest run` in `apps/web`): 20 files,
220 tests, all green on the diff as-is.

### 1. `calendar-popup.test.tsx` — focus model and keyboard-trap regression (the round-2 fix)

**Verified, real coverage, not tautological.** This was the top priority given
`refiner-notes.md`'s round-2 history on this exact point, so I checked it directly
rather than just reading it:

- `"keyboard: arrow keys move the highlighted day via aria-activedescendant on the
  trigger..."` (line 162) explicitly calls `trigger.focus()` before driving arrow keys,
  then asserts `document.activeElement === trigger` both before and after each
  `fireEvent.keyDown`. This is the actual regression check: if a future change called
  `.focus()` on a day-cell button during arrow-key handling, `document.activeElement`
  would move off the trigger and this test would fail. It also asserts
  `aria-activedescendant` tracks the highlighted cell's `id` on the trigger throughout,
  which is the positive half of the same model.
- `"every rendered day-cell button... has tabIndex={-1}..."` (line 223) iterates
  `getAllByRole("gridcell")` and asserts `tabindex="-1"` on each — this is the direct
  regression test for the keyboard-trap failure mode (`Tab` stopping at each of the
  ~28-42 day cells) the plan was revised specifically to prevent.
- I did not need to mutation-test these two by hand — the assertions are structurally
  direct (real `document.activeElement` check, real `tabIndex` attribute check) rather
  than mock-based, so a reintroduced regression (e.g. adding `cellRef.current?.focus()`
  in `moveHighlight`, or dropping `tabIndex={-1}` from the day-cell `<button>`) would
  fail these tests as written. Confirmed by inspection of `calendar-popup.tsx`'s
  `moveHighlight`/day-cell JSX against exactly these assertions.

Also confirmed leap-February (29 vs 28 days), weekday-column alignment, year-boundary
month nav, and the `minDate` inclusive-boundary case (`day === minDate` not disabled,
`day < minDate` disabled + unclickable + skipped by arrow nav with correct clamping) are
all present per plan §5, each asserting the concrete value/attribute rather than just
"didn't throw."

**Non-blocking:** `Space` (`" "`) as an alternative commit key is implemented
(`e.key === "Enter" || e.key === " "`) but never exercised by a test — only `"Enter"` is
tested for committing the highlighted day. Same code branch as the tested `Enter` path,
so risk is low; flagging in case a future refactor splits the branches.

### 2. `select.test.tsx` — full rewrite coverage

Covers keyboard nav (`ArrowDown`/`ArrowUp` open-from-closed, clamping without wraparound
at both ends, disabled-option skipping), `Enter`/`Escape`, the `onChange(value: string)`
contract, `disabled`/`required`/`className`/`id`/`name` forwarding, the
non-string-`children` throw case, and the mousedown-`preventDefault` regression check
(matching `tag-input.test.tsx`'s own documented jsdom-limitation workaround). All
assertions are on real DOM state (`aria-activedescendant`, `textContent`,
`aria-selected`, mock call args) rather than implementation internals.

**Blocking finding:** the *uncontrolled* self-managed-state path — clicking an option on
a `Select` that has no `value` prop should update the trigger's own displayed label via
`internalValue` (the `if (value === undefined) setInternalValue(option.value)` line in
`commit()`) — has no test that exercises it end-to-end (render uncontrolled → click an
option → assert the trigger's displayed label changed). Every test that opens the popup
and clicks an option either supplies `value` explicitly (the controlled test, which
correctly asserts the *opposite* — that the label does *not* self-update) or clicks a
*disabled* option (`"disabled options are skipped..."`, which explicitly expects no
change). The `defaultValue` test only checks the initial render, never an interaction
after it.

I confirmed this gap is real, not just theoretical, by mutation-testing: commented out
`if (value === undefined) setInternalValue(option.value);` in `select.tsx` (so an
uncontrolled `Select` becomes permanently stuck on its `defaultValue`/`""` no matter what
the user clicks) and re-ran every test file that touches `Select`, directly or via the
demo page:

```
npx vitest run src/routes/ui-demo-page.test.tsx src/routes/task-create-form.test.tsx \
  src/components/ui/select.test.tsx src/components/ui/date-time-picker.test.tsx \
  src/components/ui/date-range-picker.test.tsx
# Test Files  5 passed (5) / Tests  71 passed (71)
```

All 71 tests still pass with the regression in place — including
`select.test.tsx` itself and `ui-demo-page.test.tsx`'s Select block tests. Reverted the
mutation afterward (`git checkout -- apps/web/src/components/ui/select.tsx`, confirmed
clean via `git diff`/`git status`).

This matters because it's not a hypothetical: the demo page's `defaultValue="high"`
`Select` (`ui-demo-page.tsx`, the "priority" example) is exactly this uncontrolled,
self-managing usage, and it's the pattern plan §2.6 spends a full section justifying
("stays controlled-or-uncontrolled... an internal `useState<string>`..."). A regression
here would silently break that call site (and any real future consumer that uses
`Select` uncontrolled, per README precedent) with zero test signal. `ui-demo-page.test.tsx`'s
new "controlled" interactivity test (added this diff) only exercises the *controlled*
path with `onChange`; the pre-existing "defaultValue" assertion in the same file only
checks the initial render, never a post-click interaction. Recommend one added test in
`select.test.tsx`, e.g.: render `<Select defaultValue="a">`, click trigger, click a
different option, assert the trigger's `textContent` updates to the new option's label
with no `value`/`onChange` prop involved at all.

### 3. Rewritten date tests (`task-create-form.test.tsx`, `date-range-picker.test.tsx`,
   `date-time-picker.test.tsx`, `ui-demo-page.test.tsx`)

These genuinely exercise the new popup-click interaction rather than being weakened
tautologies — spot-checked by reading each rewritten assertion against what it used to
assert:

- `date-time-picker.test.tsx` and `date-range-picker.test.tsx`: every rewritten test
  still asserts a concrete outcome (`onChange` called with an exact `"YYYY-MM-DD"`
  string, or a specific gridcell's `aria-disabled` state), not just "no error." The
  `minDate` tests correctly flip from asserting a native `min` attribute to asserting
  `aria-disabled="true"` + a click producing no `onChange` call, matching plan §2.5/§3.9/
  §3.10 exactly. The "updates the end date's minDate guardrail... on re-render" test in
  `date-range-picker.test.tsx` correctly re-opens/re-checks after `rerender(...)`, so it's
  not just checking the pre-rerender state.
- `task-create-form.test.tsx`: the one test that asserts an exact `dueDate` payload value
  (`"2026-07-26"`) correctly freezes the clock (`vi.setSystemTime`) first, since the due
  date field starts empty and the calendar's default view otherwise depends on the real
  current date (needed because the empty-due-date calendar opens to "today," and without
  a frozen clock, "click gridcell 26" would produce a different actual date depending on
  when the test runs). Good catch by the implementer, and it's the correct fix (not just
  suppressed/loosened).
- `ui-demo-page.test.tsx`'s DateRangePicker interactivity test similarly freezes the
  clock and rewrites the `min`-attribute assertions to `aria-disabled` checks correctly,
  re-verifying after picking a new start date that the end calendar's guardrail actually
  moved (not just checking the initial seeded state).

**Non-blocking:** `ui-demo-page.test.tsx`'s DateTimePicker interactivity test is
measurably weaker than before in one spot. The old test asserted an exact value
(`dateInputs[0].value === "2026-08-01"`); the rewrite only asserts
`expect(dateTriggers[0]).not.toHaveTextContent("Select a date")` after clicking gridcell
`"1"`. This is because, unlike the DateRangePicker test in the same file (which does
freeze the clock), this test doesn't fix `Date.now()`, so the actual month/date produced
by clicking "day 1" is whatever the real current month is when the suite runs — an exact
assertion isn't available without either freezing the clock here too or computing the
expected string from the real current date. The loosened assertion is a legitimate,
deliberate consequence of that choice, and the precise zero-padded-date-string behavior
is still pinned down elsewhere with a frozen/known context
(`calendar-popup.test.tsx`'s exact-string test, `task-create-form.test.tsx`'s frozen-clock
test), so this doesn't leave the behavior itself untested overall — just this one
integration smoke test. Flagging so it's a known, deliberate tradeoff rather than an
unnoticed regression in rigor.

### Summary

- 1 blocking finding: `select.tsx`'s uncontrolled self-managed-state update path
  (§2 above) has no test that would catch a regression, confirmed via mutation testing
  against the full relevant test surface (not just `select.test.tsx`).
- Non-blocking: untested `Space`-key commit path on both `Select` and `CalendarPopup`
  (low risk, same branch as tested `Enter`); one demo-page integration test's assertion
  was loosened from exact-value to non-placeholder due to an unfrozen clock, while the
  precise string-formatting behavior remains rigorously covered elsewhere.
- Everything else asked for by this review (calendar-popup focus/tabIndex regression
  coverage, select.tsx keyboard/onChange/controlled-vs-uncontrolled coverage aside from
  the one gap above, and the rewritten date-interaction tests actually exercising real
  behavior rather than weakened tautologies) checked out.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scope per re-review rule: only the fix for round 1's blocking finding (commit `3e895d1`,
`test(select): cover uncontrolled defaultValue update path`). Not re-auditing anything
else from round 1 — both non-blocking notes (Space-key commit coverage,
`ui-demo-page.test.tsx`'s loosened DateTimePicker assertion) still stand as non-blocking
and don't need re-litigating.

### Verified the fix closes the gap

Read the new test in `select.test.tsx` (added between the existing `defaultValue`
initial-render test and the `value` controlled test): renders `<Select defaultValue="a">`
with no `value`/`onChange` prop, clicks the trigger, clicks the "Banana" option, and
asserts the popup closes and the trigger's `textContent` becomes "Banana" — exactly the
uncontrolled `commit()` → `setInternalValue` path flagged in round 1, exercised end-to-end
via real DOM state, not a mock.

Reproduced the fixer's mutation-testing claim myself rather than just trusting the commit
message (per the re-review rule this is fine to do once, and I hadn't personally run it
in round 1 — I'd mutation-tested the *pre-fix* code then, not this new test): commented
out `if (value === undefined) setInternalValue(option.value);` in `select.tsx` (line 137)
and ran `select.test.tsx`. Result: 1 failed / 14 passed — the new uncontrolled test is the
only failure, with the exact expected-vs-received mismatch ("Apple" instead of "Banana").
Reverted via `git checkout -- apps/web/src/components/ui/select.tsx`, confirmed
`git status` clean before and after (only the untracked `tickets/select-datepicker-refactor/`
directory present throughout, no code left modified).

Re-ran `select.test.tsx` and `ui-demo-page.test.tsx` against the real (unmutated) code
afterward: 2 files, 35 tests, all green.

### Findings

None — the fix is correct, the new test is real (structurally direct DOM assertion, not
tautological, not mock-based) and genuinely fails without the line it's meant to protect,
and it targets precisely the gap identified in round 1 with no scope creep elsewhere in
the diff.

VERDICT: APPROVED
