## reviewer-tests — round 1

Reviewed `git diff main...feat/task-list-view` (7e0afc0 due-date sort fix, d0e3f82
list-view page + due-date editing) against `tickets/task-list-view/ticket.md` (issue #8)
and `plan.md`'s edge-case list (§4). Verification performed, not just read: ran both
workspaces' test suites repeatedly, mutation-tested the key assertions by reverting small
pieces of the implementation to confirm the new tests actually fail, and checked the PR's
live CI status via `gh pr checks` / `gh run view`.

### 1. BLOCKING — the PR's own CI run fails on exactly the 4 new due-date-editing tests

`gh pr checks 45` currently shows `build: fail`. There is exactly one CI run recorded for
this branch (`gh run list --branch feat/task-list-view`), at head commit `d0e3f82` (the
current tip — confirmed identical to what's in this working tree), and it failed
(`gh run view 30398387209`). The failures are not spread randomly across the suite — all 4
failing tests are in `task-list-item.test.tsx`, and all 4 are new tests from this diff,
covering exactly the behavior I was asked to scrutinize hardest (finding 3 of my brief):

- `clicking Edit pre-fills a date-only due date` — expected `"2026-07-26"`, got `""`
- `clicking Edit pre-fills a date+time due date` — expected `"2026-07-26"`, got `""`
- `Save sends the edited due date in the update payload` — expected `dueDate: "2026-08-01"`,
  got `dueDate: null`
- `Save sends dueDate: null after clearing the date field` — expected `dueDate: null`, got
  `dueDate: "2026-07-26"` (the pre-clear value, i.e. the clear didn't register)

Pattern: in CI, `editDueDateValue` never appears to reflect either the pre-fill from
`handleEditClick` or a `fireEvent.change` on the "Edit due date" input — the state reads
back as whatever it was *before* the interaction under test, every time, for this specific
field only (title/notes/tags edits in the same file, and the "Cancel discards a due-date
edit" test, all pass fine in the same CI run).

I could **not** reproduce this locally despite substantial effort:
- 15+ isolated reruns of `task-list-item.test.tsx` alone: all green.
- `npm run test --if-present` from repo root (the literal command `ci.yml` runs): 3/3 green
  (19 web files / 229 tests, 7 server files / 112 tests).
- Reran under artificial CPU load (`yes > /dev/null` ×4 background) to simulate a
  slower/more contended runner: still green, 10/10.
- Installed and switched to Node v20.20.2 via `nvm` to exactly match
  `actions/setup-node@v4`'s `node-version: 20` (this sandbox defaults to v24): still green.
- Confirmed `jsdom` resolves to the identical `29.1.1` both here and in `package-lock.json`
  — not a dependency-drift issue.
- One variable I could *not* control for: this sandbox is `aarch64`; GitHub's
  `ubuntu-latest` runners are `x86_64`. I can't rule out an architecture-dependent timing
  or jsdom `<input type="date">` quirk, but I also can't confirm it — flagging as an
  unconfirmed hypothesis, not a diagnosis.

This is blocking regardless of root cause: `plan.md` §1 lists "CI (lint, typecheck, test,
build) stays green" as part of what "done" means, and it currently is not, on the precise
tests meant to protect this ticket's headline behavior (due-date editing). Note also that
`reviewer-code`'s round-1 notes report the same local command (`npm run -w apps/web test --
run`) as 19 files/229 passing and approve on that basis — local green is not sufficient
signoff here, since it's demonstrably not the same signal as the PR's actual CI. Recommend:
1. Don't trust local `npm test` alone for this file going forward this round — check
   `gh pr checks`/re-run CI after any fix.
2. Whether or not the root cause turns out to be a genuine implementation bug or test
   timing fragility, consider hardening these 4 assertions with `await waitFor(...)` around
   the post-`fireEvent` read (the surrounding tests in this file already `await
   waitFor(...)` on the fetch call before reading `init.body`, but these 4 read the DOM/
   assert synchronously right after `fireEvent.click`/`fireEvent.change` with no `waitFor`)
   as a cheap, low-risk mitigation independent of diagnosing the exact cause.
3. If a second CI run on the same commit (or a trivial re-push) comes back green, treat
   this as a real flake to still investigate (a test that's this specifically clustered
   around one new field failing 100% of the time in the one CI run we have is not
   obviously "just noise"), not as license to ignore it.

### 2. `task-service.test.ts`'s `orderBy` assertion — verified to catch the regression

Mutation-tested directly: reverted `task-service.ts`'s `orderBy` to the old
`{ dueDate: "asc" }` while leaving the test as-is → `expect(db.entry.findMany)
.toHaveBeenCalledWith(expect.objectContaining({ orderBy: { dueDate: { sort: "asc", nulls:
"last" } } }))` fails immediately, as expected (re-reverted after confirming). This is a
call-args/shape assertion, not a real-SQLite integration test (per `plan.md` §3.2/§4's own
documented limitation, consistent with this test file's existing style for every other
`orderBy`/`where`/`include` shape) — that limitation is explicitly acknowledged in the plan
and not a new gap introduced by this ticket. No finding here; this specifically satisfies
the "would it catch a regression to plain `{dueDate: "asc"}`" question from my brief.

### 3. `task-due-date.test.ts` — genuinely meaningful, not tautological

Round-trip/null/undefined/midnight-heuristic/clear-on-update cases are real: each encodes
an independently-derivable expected value (not copy-pasted from the implementation's own
logic), and this repo's/CI's environment is UTC (confirmed `TZ` unset, `date` prints UTC,
and `Intl.DateTimeFormat().resolvedOptions().timeZone` returns `"UTC"`), matching the
"round-trips exactly in UTC" caveat the plan and code comments both call out — so the
round-trip assertions aren't silently relying on an assumption that's false in this actual
test environment. The midnight-heuristic test is explicitly framed (in both plan.md and the
test name) as documenting a known, accepted limitation rather than asserting "correctness,"
which is the right call — no finding.

### 4. `task-list-item.test.tsx`'s new due-date tests — well-designed (setting aside finding 1)

Mutation-tested two more scenarios to confirm these tests exercise real wiring, not mocks-only:
- Removed `dueDate: dueDatePayloadForUpdate(editDueDateValue)` from `handleSave`'s mutate
  call → 8 tests fail (all 4 "Save ..." tests plus 4 pre-existing tests whose expected
  payload objects were updated in this diff to include `dueDate: null`). Confirms the
  payload-shape assertions are real, not vacuous.
- Removed `setEditDueDateValue(dueDateValueFromWireDate(task.dueDate))` from
  `handleEditClick` → both "pre-fills" tests fail correctly (`expected '' to be
  '2026-07-26'`).
Both mutations were reverted after confirming. Combined with finding 3's unit coverage,
these tests would legitimately catch a regression in either direction (payload omission or
missing pre-fill) — the *design* of these tests is sound. The problem is narrowly that they
don't currently pass in CI (finding 1), not that they're poorly targeted.

The plan's other called-out edge cases for this area are present and reasonable:
"Cancel discards a due-date edit" (no fetch call, edit mode exited, original due-date text
still shown), the partial/legacy-fixture-missing-`dueDate` defensive test (mirrors the
existing `completed`/`tags` partial-fixture pattern), and the inline-error-preserves
`editDueDateValue` test (real assertion on the input's post-error value, not just
`toHaveBeenCalled()` on the mutation mock).

### 5. Section/Panel/Card restyle — no broken test queries, adjusted appropriately

`grep -n "querySelector\|container\."` across both `task-list-item.test.tsx` and
`tasks-page.test.tsx` returns nothing — every existing assertion is
text/role/label-based, confirmed by running the full suite (all pre-existing tests in both
files still pass unmodified apart from the payload-shape updates already covered in finding
4). The one new test (`tasks-page.test.tsx`'s "renders the Tasks heading") correctly
targets `getByRole("heading", { name: "Tasks" })`; `Section` renders an `h2` for that title
and `Panel` renders a separate `h3` ("Add a task"), so the query is unambiguous — checked
both components' source directly rather than assuming. No finding.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scoped to `git diff 08bd08a...583ce65` (fix commit on top of the merge-main commit), per
the re-review scope rule — not a full re-audit of round 1's already-approved findings.
Root cause of round 1's finding 1 (4 CI-only failures) is now understood and fixed: this
branch predates PR #40 (Select/Datepicker refactor merging the CalendarPopup-based
`DateTimePicker`), and GitHub's default `pull_request` merge-commit checkout meant CI was
silently exercising the new popup UI the whole time while every local run used the stale
pre-#40 native `<input type="date">`. Confirmed CI is now green on this exact commit:
`gh pr checks 45` → `build pass` at head `583ce650351b7665aa08ab12fe0e1f64ef29253c`. Also
reran the file directly (`npx vitest run src/routes/task-list-item.test.tsx`): 39/39 pass.

### 1. Rewritten due-date tests genuinely exercise the real CalendarPopup, not a shortcut

Mutation-tested five distinct ways, each reverted after confirming:

- Removed `dueDate: dueDatePayloadForUpdate(editDueDateValue)` from `handleSave` → 8 tests
  fail (both "Save ..." tests plus the 4 already-passing tests whose expected payloads
  include `dueDate`), same as round 1.
- Removed `setEditDueDateValue(dueDateValueFromWireDate(task.dueDate))` from
  `handleEditClick` → 5 tests fail, including both pre-fill tests and (correctly, as a
  side effect of `editDueDateValue.date` never being truthy) the Clear-button tests and
  the Cancel test.
- **Broke `CalendarPopup.commitDay` itself** (commented out its `onChange(...)` call, so
  clicking a `gridcell` no longer updates the value) → "Save sends the edited due date in
  the update payload" and "renders an inline error ... editDueDateValue preserved" both
  fail correctly. This is the strongest possible confirmation for the brief's specific
  ask: the test drives the actual trigger-button-click → gridcell-click flow through the
  real `CalendarPopup` component, not a mock or a bypassed shortcut — breaking the
  popup's real commit logic is caught, not just breaking the wiring in
  `task-list-item.tsx`.
- Made the "Clear due date" button's `onClick` a no-op → both tests that depend on it
  (the new Clear-button test itself, and "Save sends dueDate: null after clearing") fail
  correctly.
- Made the "Clear due date" button unconditionally rendered (dropped the
  `editDueDateValue.date &&` guard) → both the new test's own assertion
  (`queryByRole(... "Clear due date").not.toBeInTheDocument()` after clearing) and the
  pre-existing "clicking Edit on a task with no due date" test's equivalent assertion
  fail correctly — confirms the "only appears when a date is set" half of the brief's
  ask 2, in both directions (appears when set, disappears when cleared/absent).

No co-passing-with-broken-implementation risk found for any of the behaviors the fix
commit touches.

### 2. Non-blocking — "Clear due date" doesn't get a date+time regression test

Mutation-tested a 6th variant: changed the Clear button's handler from
`setEditDueDateValue({ date: "" })` to `setEditDueDateValue({ ...editDueDateValue, date: ""
})` (preserving a stray `time` field instead of resetting the whole value). All 39 tests
still pass — nothing in this diff exercises Clear on a task that has both a date *and* a
time set. Checked whether this is a real bug: `dueDatePayload`'s `if (!value.date) return
undefined` means the wire payload still correctly comes out as `null` either way, so this
wouldn't be a data-correctness regression — only a UI-state one (the "Add time" checkbox
and time `<input>` would stay visibly populated after clicking "Clear due date" on a
date+time task, which reads as broken even though Save still sends the right payload).
Given severity is UI-cosmetic only (not data loss, not caught by the existing
`dueDatePayload`/`dueDatePayloadForUpdate` unit tests either, since those operate on
already-well-formed `DateTimePickerValue`s, not on what the Clear button itself
constructs) and this is explicitly the final fix round (`AGENT_RULES.md`'s 2-round cap),
flagging as non-blocking rather than sending back for a 3rd round. Worth adding a
`makeTask({ dueDate: "2026-07-26T14:30" })` + Clear-button case in a future ticket that
touches this file.

### 3. New "Clear due date" test coverage — verified real, not just present

- Button visibility is both-directions tested: appears after Edit on a task with an
  existing due date (existing "pre-fills a date-only due date" test path implicitly, plus
  the new test asserts it directly), and confirmed absent on a task with no due date and
  after clearing (mutation-tested above, finding 1's last bullet).
- Clicking it resets the trigger's displayed text to "Select a date" and does **not**
  call `fetchImpl` — asserts real behavior (`toHaveTextContent`, not a mock-call
  assertion alone), and correctly distinguishes "reset local edit state" from "save."
- "Save sends dueDate: null after clearing the date field" now uses the Clear button
  (not a stale `fireEvent.change` on a removed native input) and was directly
  mutation-tested in finding 1 to fail when either the button's handler or the guard
  condition breaks.

### 4. No coverage regression vs. the original (pre-#40) test intent

Comparing the diff line-by-line against round 1's already-approved test list (finding 4
of round 1's notes): every previously-covered scenario is still covered by the rewrite —
date-only pre-fill, date+time pre-fill (still asserts the native time `<input>`'s value,
untouched since `DateTimePicker`'s time sub-field is still a native input post-#40), Save
sends the edited date, Save sends `null` after clearing, Cancel discards without calling
update, empty-due-date-on-Edit, partial-fixture-missing-`dueDate`, and the inline-error
editDueDateValue-preservation case. The `vi.useFakeTimers()`/`vi.setSystemTime()` additions
in the two tests where `CalendarPopup`'s default view matters (no pre-existing date, so it
falls back to "today") match the established pattern already used in
`task-create-form.test.tsx` — checked that file's usage directly, same
`setSystemTime(new Date(2026, 6, 1))` shape. No test was weakened, deleted, or reduced in
specificity; the picked-date value changed from `"2026-08-01"` to `"2026-07-26"` (clicking
a visible day in the default month view rather than navigating), which is an equivalent
substitution for what the test is proving (payload reflects a real, non-null user
selection), not a coverage reduction.

### 5. `task-list-item.tsx` diff itself — matches test expectations, no dead code

The `Clear due date` `<Button>` only renders conditionally
(`{editDueDateValue.date && (...)}`), sits inside the same `flex items-center gap-2` row
as `DateTimePicker`, and its handler is a plain `setEditDueDateValue({ date: "" })` — no
`variant`/`size` mismatch or accessibility-name collision with any other button in the
edit form (`getByRole("button", { name: "Clear due date" })` is unambiguous, confirmed by
running the suite). Nothing here needed reviewer-code's lane; noted only because it's the
one line of source this fix round touches beyond the test file.

VERDICT: APPROVED
