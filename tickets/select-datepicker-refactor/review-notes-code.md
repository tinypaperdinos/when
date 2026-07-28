# Review notes (code): select-datepicker-refactor

## reviewer-code — round 1

Reviewed `git diff main...feat/select-datepicker-refactor` (57d5ee1 Select/Phase A,
7e36b87 calendar popup/Phase B) against `ticket.md` (issue #30) and `plan.md`
(round-2-approved, including §3.5's ARIA focus model). Ran the actual checks, not just
read the diff:

- `npm run --workspace apps/web test -- --run`: 20 files / 220 tests, all pass.
- `npm run --workspace apps/web typecheck`: clean.
- `npm run --workspace apps/web lint`: clean.
- `gh pr checks 40`: CI `build` job (lint+typecheck+test+build) green.
- Booted the Vite dev server and confirmed `/dev/ui` serves (SPA shell renders); didn't
  spin up a browser for interaction QA per `AGENT_RULES.md`'s reviewer-code scope note —
  jsdom test coverage of the same interactions is thorough (see below) and nothing found
  needed browser-level confirmation.

### 1. Scope fidelity vs. `ticket.md` / `plan.md`

No missed requirements, no unrequested scope. Verified point-by-point:

- `Select` no longer renders a native `<select>` (`select.tsx`): confirmed, hand-rolled
  button+listbox per plan §3.1.
- `DateTimePicker`'s date field is now `CalendarPopup`; the time field is untouched
  (`date-time-picker.tsx` diff is a clean single-field swap, `TextInput type="time"`
  still present, `Checkbox`/`timeOptional` branching byte-for-byte unchanged) — matches
  plan §2.4/§3.8 exactly.
- `DateRangePicker` production code untouched (confirmed via `git diff --stat`: only
  its test file changed) — picks up the calendar for free by composition, per plan §3.10.
- `task-due-date.ts`/`task-create-form.tsx` production code untouched (plan §3.14
  "verify, don't modify") — confirmed via diff stat; only `task-create-form.test.tsx`
  changed.
- `README.md` updated with both documented deviations (`Select` staying
  controlled-or-uncontrolled outside the composite family, `DateTimePicker`'s date field
  / `minDate` enforcement change) — matches plan §2.6/§2.5/§3.4/§3.13.
- No new npm dependency (`package.json`/`package-lock.json` untouched, confirmed via
  diff stat) — matches plan §2.1.
- No backend/Prisma/tRPC changes — confirmed, diff stat shows zero touched files under
  `apps/server`.
- Demo route (`ui-demo-page.tsx`) updated: existing uncontrolled `Select` examples left
  untouched (zero structural change, matches plan §3.3's "no structural change"
  prediction), and a new controlled example was added using the new
  `onChange={setValue}` signature — this was explicitly optional per plan §3.3 ("not
  strictly required... but cheap and consistent") and the implementer did it; fine,
  matches the plan's own stated option, not scope creep.

**Verified claim 1 (the "gap" the implementer found and mechanically fixed without
asking):** `task-create-form.test.tsx`'s two due-date tests and
`date-range-picker.test.tsx`'s three `min`-attribute tests were genuinely not named in
plan §4/§3.10's file inventory. Read every changed line in both files (diffs above) —
in all five cases the change is a 1:1 mechanical translation of the same interaction
(`fireEvent.change` on a native date input with a target value → `fireEvent.click` the
trigger button + `fireEvent.click` the corresponding `gridcell`) with **no new
assertions and no relaxed assertions** — the same due date, same "unaffected by
start/end constraints" behavior, same final payload/value is asserted before and after.
One test (`task-create-form.test.tsx`'s "submits... dueDate payload") added
`vi.useFakeTimers()`/`vi.setSystemTime` because the calendar's default-open month now
depends on "today" when the field starts empty (a real, new dependency introduced by
the popup's design, not present for a plain text input) — this is a legitimate,
necessary adaptation to keep the test deterministic, not a behavior change. This is
exactly the kind of "test file was already touching the changed surface, plan's file
list was incomplete, mechanical fix consistent with plan's own stated interaction-
rewrite pattern (§3.9/§3.10/§3.12)" fill-in the plan anticipates elsewhere for
`date-time-picker.test.tsx` and `ui-demo-page.test.tsx`. Not a hidden scope or behavior
change. No blocking finding here.

**Verified claim 2 (`Select`'s `onChange` breaking change):** grepped the whole
monorepo (not just `apps/web/src/routes`) for any file importing from `./select` /
`ui/select` — only `ui-demo-page.tsx` and `select.test.tsx` do. Diffed `main`'s
`ui-demo-page.tsx` Select section directly: **neither pre-existing demo example (`with
placeholder`, `with defaultValue`) ever passed an `onChange` prop at all** — both are
purely uncontrolled. So the "zero real call sites need updating" claim is stronger than
even the plan states (plan says "zero non-demo consumers"; turns out zero *demo*
call sites used the old signature either — there was nothing to migrate at every
existing call site). The one new `onChange` usage added in this diff
(`onChange={setControlledFruit}`) correctly uses the new `(value: string) => void`
signature. Confirmed: every real call site was updated (there were none using the old
signature to update), and the claim holds.

### 2. Correctness

Traced the logic in both new/rewritten components against plan §5's edge-case list and
the round-2-approved §3.5 focus model. No blocking issues found:

- `select.tsx`: `deriveOptions` throws a clear error for non-string `<option>` children
  (tested); `openPopup`/`moveHighlight`/`nextEnabledIndex` correctly clamp (no wrap) and
  skip disabled options; controlled-vs-uncontrolled (`value !== undefined ?
  value : internalValue`) matches plan §2.6 exactly, including the `TODO(#26)` removal.
  `required` → `aria-required`, `disabled` → native `disabled` on the trigger (blocks
  both click and keydown via early return), `className` merges onto the trigger not the
  wrapper — all match plan §5.
- `calendar-popup.tsx`: `id` scheme is exactly `` `${gridId}-day-${dateString}` `` via a
  single `useId()` scoped to the component (not the consumer `id` prop, which stays on
  the trigger) — matches plan §3.5 verbatim. Every day-cell button is `tabIndex={-1}`
  (verified directly in both the component and a dedicated test); `role="grid"` wraps
  `role="row"` wraps `role="gridcell"` buttons — correct structural nesting (round-1
  refiner finding, closed). `aria-activedescendant` is set only on the trigger, only
  while open, and real DOM focus never moves off the trigger (verified: no `.focus()`
  call anywhere in the file on a cell ref; a dedicated test asserts
  `document.activeElement === trigger` through several arrow-key presses). `minDate` is
  an inclusive lower bound (`< minDate`, not `<=`) — matches plan §2.5's "boundary day
  itself is not disabled" requirement, and is directly tested. Leap-February (2028: 29
  days) vs. non-leap (2026: 28 days) both verified by test and cross-checked
  independently (`date -d "2026-02-01" +%A` → Sunday, `2026-07-01` → Wednesday — the
  "3 leading blank cells" test assertion is arithmetically correct, not just
  self-consistent with the implementation).
- `date-time-picker.tsx`: single-field swap is exactly as narrow as plan §3.8 specifies
  — read the full file; nothing else changed.
- No race/off-by-one issues found in the day/week arithmetic, month-boundary navigation
  (Dec→Jan/Jan→Dec tested and correct), or zero-padding (`pad2`, tested with day 5 of
  month 3 → `"…-03-05"`).

### 3. Design

- Consistent with the codebase's established hand-rolled-combobox precedent
  (`tag-input.tsx`): same blur+`onMouseDown preventDefault()` popup-close mechanism, same
  visual recipe (`field-base`, `border-2 border-ink`, `shadow-hard`) reused for both new
  widgets' popups.
- Non-blocking observation: `select.tsx` and `calendar-popup.tsx` each independently
  define a near-identical `Direction`/`nextEnabledIndex`-shaped skip-disabled-entries
  helper (different element types — option index vs. day number — so not a pure
  duplicate, but conceptually the same "find next enabled item in a direction, clamped"
  logic). Plan §2.7 anticipated this ("both widgets reuse this exact mechanism") without
  mandating a shared utility, and the two implementations are simple enough (~10 lines
  each) that extracting a shared generic helper would likely cost more indirection than
  it saves for two call sites. Not blocking; worth a one-line mention only if a third
  widget needing the same shape shows up later.

### 4. Simplification

Nothing found that's meaningfully over-engineered. The `Select`/`CalendarPopup` split
(separate files, `CalendarPopup` not exported from the public surface) matches the
`chevron-down-icon.tsx`/`select.tsx` precedent the plan calls out, and neither component
carries logic beyond what plan §3.1/§3.5 and §5's test list call for.

### Non-blocking notes for future reference

- Weekday header row (`WEEKDAY_LABELS`) renders as plain `<span>`s with no
  `role="columnheader"`/`role="row"` wrapper under the `role="grid"` — this was already
  flagged non-blocking in `refiner-notes.md` round 2 ("full grid-header conformance...
  outside the bounded-subset philosophy... not an oversight worth blocking on"). Still
  true; not re-raising as a new finding.
- `deriveOptions(children)` re-walks `children` on every render of `Select` (no
  memoization). Fine at this scale (a handful of `<option>` elements, re-render only on
  genuine state/prop changes) — flagging only because it's the kind of thing that could
  matter if `Select` ever gets a large dynamically-generated option list, not a problem
  today.

### Verification of the two specifically-flagged areas (summary)

1. **Test gap fill-in** (`task-create-form.test.tsx`, two `date-range-picker.test.tsx`
   tests): legitimate mechanical translation to the new popup interaction pattern, no
   behavior/assertion changes beyond what the interaction-model swap requires. Not a
   hidden scope change.
2. **`Select` onChange breaking change**: verified true and fully handled — zero real
   (non-demo) consumers monorepo-wide, and in fact zero *demo* call sites even used the
   old `ChangeEvent` signature, so there was nothing to migrate. The new controlled demo
   example correctly uses `(value: string) => void`.

VERDICT: APPROVED

## reviewer-code — round 2

Scoped per `AGENT_RULES.md`'s re-review rule: only the fix commit `3e895d1` (the sole
commit after `7e36b87`), not a full re-audit. Round 1 (above) is still APPROVED and not
re-derived.

- `git show --stat 3e895d1`: touches exactly one file, `apps/web/src/components/ui/select.test.tsx`
  (+18/-0). No production code changed — confirmed via `git diff 7e36b87..3e895d1 --
  ':!*.test.tsx' ':!tickets/**'` returning nothing. This directly addresses
  `review-notes-tests.md` round 1's sole blocking finding (uncontrolled-mode
  `setInternalValue` path in `select.tsx`'s `commit()` had no test coverage).
- Read the added test: renders `<Select aria-label="fruit" defaultValue="a">` with no
  `value`/`onChange`, asserts initial trigger text is "Apple", clicks the trigger then
  clicks the "Banana" option, and asserts the popup closes
  (`queryByRole("listbox")).not.toBeInTheDocument()`) and the trigger's text updates to
  "Banana". This exercises exactly the previously-uncovered branch (`if (value ===
  undefined) setInternalValue(option.value)` in `select.tsx:137`) end-to-end through
  user interaction, not just initial-render state — matches what `review-notes-tests.md`
  round 1 asked for verbatim.
- Ran it: `npm run --workspace apps/web test -- --run select.test.tsx` → 15/15 pass
  (was 14 before this commit). The fix commit's own message reports mutation-testing
  this claim (commented out the `setInternalValue` line, confirmed only the new test
  fails, reverted) — per `AGENT_RULES.md`'s "don't duplicate verification across the two
  reviewers" note, I did not independently re-run that mutation since it's already
  reported in the commit and is `reviewer-tests`'s check to reproduce if it chooses to.
- No scope creep: the commit is test-only, doesn't touch `select.tsx` or any other
  production file, and doesn't introduce anything beyond the one requested test case.

No blocking findings.

VERDICT: APPROVED
