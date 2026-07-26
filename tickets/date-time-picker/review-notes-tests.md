## reviewer-tests — round 1

Reviewed `git diff main...origin/feat/date-time-picker` (implementer commit `d3e459c`)
against `tickets/date-time-picker/plan.md` §4 and issue #16. Ran the full new test suite
(`date-time-picker.test.tsx`, `date-range-picker.test.tsx`, `ui-demo-page.test.tsx` — 46
tests total, all passing) in an isolated worktree, and did targeted mutation testing
(reverting specific behaviors, confirming the relevant test fails) rather than just
reading assertions.

### Round-1 regression test (`addTimeLabel` forwarding) — verified, does its job

Confirmed by mutation: reverted `date-range-picker.tsx` to drop `addTimeLabel={...}` from
both `DateTimePicker` calls (reproducing the exact pre-fix bug §2.6/§3.2 describe). Re-ran
`date-range-picker.test.tsx` + `ui-demo-page.test.tsx` against that reverted code:

```
✓ src/routes/ui-demo-page.test.tsx ... (all pass)
× DateRangePicker > with timeOptional=true, shows both toggles and toggling one side does not affect the other
× DateRangePicker > regression: the two 'Add time' toggles have distinct default text and the shared 'Add time' default is never rendered
× DateRangePicker > propagates startLabel/endLabel overrides into legends and all three composed labels per side
× DateRangePicker > disables every sub-control on both sides
 Test Files  1 failed | 1 passed (2)
      Tests  4 failed | 28 passed (32)
```

The dedicated regression test (`regression: the two 'Add time' toggles have distinct
default text...`) fails as intended, and does so via the exact assertions the plan called
for: `getByLabelText("Add start time")`/`getByLabelText("Add end time")` both resolve, and
`queryByLabelText("Add time")`/`queryByText("Add time")` are both absent. This is a real,
would-catch-the-bug test, not a tautology — **non-blocking, confirmed good.**

### Blocking: unchecking "Add time" doesn't verify `date` survives the rebuild

`date-time-picker.tsx`'s uncheck branch reconstructs the value manually
(`onChange({ date: value.date })`) instead of the plan's rest-destructure sketch — a
reasonable, called-out implementation choice, but it's exactly the kind of hand-rebuilt
object literal that's easy to typo/simplify incorrectly later (e.g. `onChange({})`,
dropping the date). The test for this path only asserts:

```ts
const result = onChange.mock.calls[0][0] as DateTimePickerValue;
expect(result.time).toBeUndefined();
```

— never checking `result.date`. I mutated the uncheck branch to `onChange({} as never)`
(silently dropping `date` on uncheck — a real, user-visible data-loss bug: unchecking "Add
time" would wipe the already-entered date) and reran `date-time-picker.test.tsx`: **all 14
tests still pass.** Nothing in the suite catches this. Contrast with the "checking Add
time" test right above it, which does `expect(onChange).toHaveBeenCalledWith({ date:
"2026-07-26", time: "" })` — a full-object match that would catch the equivalent bug on
that branch. The uncheck test should do the same (`toHaveBeenCalledWith({ date:
"2026-07-26" })` or equivalent `result.date` assertion) rather than only checking `.time`.
This is the one condition in plan §4 ("Unchecking 'Add time' ... calls onChange with a
value whose time key is absent") that the plan itself under-specified (didn't also ask for
date preservation) but which is a genuinely risky, plausible real bug given the exact
implementation shape used — **blocking.**

### Verified as sound (mutation-tested, not just read)

- `DateRangePicker`'s "changing the end date" test: cross-wired the end `onChange` handler
  to write into `value.start` instead of `value.end` — caught immediately (1 test fails).
  Confirms `value.start`/`value.end` independence is genuinely exercised, not just
  asserted against a trivial no-op mock.
- `DateTimePicker`'s "checking Add time" / "changing date" / "changing time" /
  `timeOptional={false}` tests all use `toHaveBeenCalledWith(<full object>)`, which is the
  right pattern — would catch a dropped/duplicated field, unlike a partial-field
  assertion.

### Non-blocking: "toggling one side does not affect the other" only tests one direction

Plan §4 asks for "toggling start's doesn't affect end's, and **vice versa**." The actual
test (`with timeOptional=true, shows both toggles and toggling one side does not affect
the other`) only fires `Add start time` and checks `result.end.time` is untouched; there's
no mirrored assertion for clicking `Add end time` and checking `result.start` is
untouched. Given the two `DateTimePicker` instances are structurally identical/mirrored
(same component, same prop-passing pattern, verified by reading `date-range-picker.tsx`),
an asymmetric bug here is low-probability, and the adjacent "changing the end date" test
already demonstrates cross-wiring bugs between start/end get caught elsewhere in the file.
Worth a one-line addition, not launch-blocking.

### Non-blocking: `disabled` tests don't assert `onChange` was never called

Both `DateTimePicker`'s and `DateRangePicker`'s disabled tests fire `fireEvent.change`/
`fireEvent.click` on disabled controls and assert the rendered `.value`/`.checked` didn't
move, but never assert `expect(onChange).not.toHaveBeenCalled()`. Per the test's own
comment, this is intentional and matches existing precedent (`TextInput`/`Select`'s own
disabled tests use the same style) since `fireEvent` dispatches synthetic events that
bypass native `disabled`-blocks-interaction semantics, so an `onChange`-not-called
assertion would be unreliable here regardless. Since the render in these tests is
non-reactive (a bare `vi.fn()`, not wired back into `value`), the "value unchanged"
assertion holds regardless of whether `onChange` fired — but the adjacent
`toBeDisabled()` assertions on every sub-control do still catch a missing `disabled`
prop-forwarding regression, which is the actual risk here. Pre-existing pattern, not a
new gap introduced by this diff — **non-blocking.**

### Other coverage checked and found adequate

- `DateTimePicker` default-render, mount-with-existing-time, `timeOptional={false}`,
  label-override (+defaults-absent), `minDate`, `className`, disabled, and
  render-without-throwing cases from plan §4 are all present and each is
  behavior-specific (uses `getByLabelText`/`queryByLabelText`/`toHaveAttribute`, not
  snapshot or mock-call-count-only assertions).
- `DateRangePicker` default legends, default `timeOptional=false`, `min` guardrail (both
  branches + re-render case), label propagation (including the round-1-added toggle-label
  assertion), disabled, `className`, and render-without-throwing are all present and
  correctly targeted.
- Demo route test (`ui-demo-page.test.tsx`) actually drives interaction (`fireEvent.click`
  reveals the time field, `fireEvent.change` updates `.value` and the `min` guardrail) per
  plan §3.6, not just presence checks.
- No test relies on jsdom's `valueAsDate`/native date-picker popup — confirmed by reading
  every test; all assert plain string `.value` via `fireEvent.change`, matching plan's
  explicit "not planned" carve-out. No jsdom value-sanitization quirks were hit (full
  suite passes cleanly).

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scoped to the diff since round 1 (`d3e459c` → `aa00c22`, per the re-review scope rule):
one line added to `date-time-picker.test.tsx`.

### Blocking finding from round 1 — verified closed

Fix commit `aa00c22` adds `expect(onChange).toHaveBeenCalledWith({ date: "2026-07-26" })`
to the "calls onChange with an absent time key when unchecking 'Add time'" test, before
the existing `result.time` assertion. Reproduced the round-1 mutation myself rather than
trusting the commit message: patched `date-time-picker.tsx`'s uncheck branch from
`onChange({ date: value.date })` to `onChange({} as never)` (the exact silent-data-loss
mutation from round 1 — dropping `date` on uncheck) and reran
`date-time-picker.test.tsx`:

```
✓ 13 passed
× calls onChange with an absent time key when unchecking 'Add time'
  expected "vi.fn()" to be called with arguments: [ { date: '2026-07-26' } ]
  Received: [ {} ]
```

Exactly one test fails — the one that was blind to this bug in round 1 — and it fails
for the right reason (the new `toHaveBeenCalledWith` assertion). Reverted the mutation
(`git diff` on the file now shows no changes) and reran the full new-component suite
(`date-time-picker.test.tsx` + `date-range-picker.test.tsx` + `ui-demo-page.test.tsx`):
46/46 pass. **Gap closed — confirmed, not just asserted.**

### Non-blocking items from round 1 — confirmed untouched, not silently regressed

`git diff d3e459c aa00c22 -- date-time-picker.test.tsx date-range-picker.test.tsx` shows
the *only* change across both files is the single line above.
`date-range-picker.test.tsx` is byte-identical to round 1: the "toggling one side does
not affect the other" test is still one-directional (fires `Add start time`, checks
`result.end.time`; no mirrored `Add end time` → `result.start` case), and neither
`DateTimePicker`'s nor `DateRangePicker`'s disabled tests assert
`expect(onChange).not.toHaveBeenCalled()`. This matches the fix commit's stated intent
("left the two non-blocking observations alone per the reviewer's own note...") — no
scope creep, no accidental regression. Both remain low-risk per round-1 reasoning
(structurally mirrored components; `fireEvent`-bypasses-native-`disabled` limitation is
pre-existing precedent, not new) — still non-blocking, no new action needed.

### Scope note

Per `AGENT_RULES.md`'s re-review rule, did not re-run the full 46-test suite's every
individual assertion from scratch, re-derive round-1's other "verified as sound" mutation
tests, or duplicate `reviewer-code`'s check of the same fix commit — only re-verified the
one blocking claim end-to-end (mutate → fail → revert → pass) since that's the crux of
whether round 1's gap is actually closed, plus a diff-based check that nothing else moved.

VERDICT: APPROVED
