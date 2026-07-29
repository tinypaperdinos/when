## reviewer-code — round 1

Reviewed `git diff main...feat/task-list-view` (7e0afc0 due-date sort fix, d0e3f82
list-view page + due-date editing) against `tickets/task-list-view/ticket.md` (GitHub
issue #8, re-fetched via `gh issue view 8` and confirmed it matches `plan.md`'s quoted
text) and `plan.md`.

### Verification performed (not just read)

- `npm run -w apps/web test -- --run`: 19 files / 229 tests pass.
- `npm run -w apps/server test -- --run`: 7 files / 112 tests pass.
- `npm run -w apps/server typecheck`, `npm run -w apps/web typecheck`, `npm run -w apps/web lint`: clean.
- `npm run build` (both workspaces): succeeds, Vite bundle produced.
- Ran the `nulls: "last"` orderBy against **real SQLite** (not the mocked unit test) via
  a throwaway `tsx` script using the repo's actual `dev.db` and Prisma client: created one
  undated task and one dated task, queried with
  `orderBy: { dueDate: { sort: "asc", nulls: "last" } }`. Result: dated task first, undated
  task last — confirms the fix works at runtime, not only that the correct shape is passed
  to the mocked `findMany`. `dev.db` is gitignored so the throwaway rows are harmless and
  the file/script were deleted after.
- Confirmed no preview flag is needed for Prisma null-ordering (`schema.prisma`'s
  `generator client` block has no `previewFeatures`, consistent with plan.md §3.1's claim
  that this has been stable since Prisma 4.x; repo is on `~6.19.3`).

### 1. Due-date sort fix — correct

`{ dueDate: { sort: "asc", nulls: "last" } }` is valid, stable (non-preview) Prisma syntax
for a nullable scalar field on this schema (`dueDate DateTime?`), and genuinely fixes the
claimed bug (verified against real SQLite, see above, not just the mocked test). The test
update in `task-service.test.ts` correctly matches the new `orderBy` shape.

### 2. No dependency on unmerged sibling PRs (#38/#39/#40) — confirmed

- `apps/web/src/components/ui/modal.tsx` does not exist on `feat/task-list-view` (matches
  main) and is not imported anywhere in the diff.
- `card.tsx` and `date-time-picker.tsx` are untouched by this diff and identical to the
  versions merged on `main` (`padding: "sm" | "md"`, plain bordered `div`; native
  `<input type="date">`/`<input type="time">`-based picker) — no diff against
  `main...feat/task-list-view` for either file. The `Card`/`DateTimePicker` usage in
  `task-list-item.tsx` is consistent with these current APIs, not #39's/#40's refactors.
- No `EmptyState`/`LoadingState` imports; loading/empty/error states stay plain `<p>` with
  `text-ink/60`, as planned.

### 3. `dueDateValueFromWireDate`/`dueDatePayloadForUpdate` type handling — correct, not just asserted

`dueDateValueFromWireDate(wireDueDate: string | Date | null | undefined)` genuinely widens
the parameter type to accept both the TS-inferred `Date` (from `Task["dueDate"]`, per
`trpc.ts`'s documented caveat) and the actual runtime `string`, rather than using an `as`
cast to paper over the mismatch. Confirmed `Task["dueDate"]` really is inferred as
`Date | null` (from `apps/web/src/trpc.ts`'s own comment and type derivation off
`AppRouter`), and confirmed the server's `taskUpdateFields` schema
(`apps/server/src/services/task-schema.ts`) has `dueDate: wireDateTimeString.nullable().optional()`,
which lines up with `dueDatePayloadForUpdate`'s `string | null` return type (explicit
`null` clears, unlike the create-direction `dueDatePayload`'s `undefined`-means-omit).
`new Date(...)` legitimately accepts both `string` and `Date` inputs, so the widened
signature is sound, not just typed permissively.

The `undefined` branch (used by the "partial/legacy fixture missing `dueDate` entirely"
test) is exercised by both a `task-due-date.test.ts` case and a
`task-list-item.test.tsx` case that deletes the field via `delete task.dueDate` — matches
plan.md §4's edge case list.

### 4. Scope fidelity — no new tag/note backend work

`git diff main...feat/task-list-view --stat` touches only `task-service.ts`/`.test.ts`,
`task-due-date.ts`/`.test.ts`, `task-list-item.tsx`/`.test.tsx`, `tasks-page.tsx`/`.test.tsx`
— no router, schema, or Prisma files under any tag/note path are touched. Tags/notes are
rendered via the already-existing `Badge`/`TagInput`/`Textarea` wiring, restyled into
`Card`, not re-plumbed. Matches the ticket's actual ask (present already-wired tags/notes
well) and plan.md §5's explicit scope boundaries (no completed-task filtering, no notes
truncation, no page-level "no due date" grouping — none of these appear in the diff).

Also confirms: no dedicated `/tasks/new`/`/tasks/:id/edit` routes were added (matches the
plan's §6.1 resolution), and `router.ts`/`root-route.tsx` are untouched (no diff against
either), consistent with "no `/calendar` link, no new routes" from plan.md §0/§2.

### 5. Code comments — compliant with `AGENT_RULES.md`

The two new comment blocks in `task-due-date.ts` (on `dueDateValueFromWireDate` and
`dueDatePayloadForUpdate`) are single-paragraph "why" comments (type-widening rationale,
update-vs-create semantics) — not line-by-line narration, no PR/review-thread context
baked in. The stale comment on the old `dueDatePayload` (explaining why only the
create-direction conversion existed) was correctly deleted now that the reverse direction
exists. No other comments added in the diff besides one `@ts-expect-error` on a
deliberately-malformed test fixture, which is self-explanatory.

### 6. Minor/design observations (non-blocking)

- `dueDateValueFromWireDate`'s local `pad` helper duplicates nothing else in the codebase
  (`grep -rn padStart apps/web/src` finds only this one definition) — fine, no
  copy-paste-instead-of-share issue.
- `DateTimePicker` label props (`dateLabel="Edit due date"` etc.) don't collide with
  `TaskCreateForm`'s `"Due date"`/`"Time"`/`"Add time"` labels on the same page — checked
  `task-create-form.tsx` directly to confirm the labels actually differ, not just trusting
  the plan's claim.
- `<li><Card padding="sm">...</Card></li>` is valid markup (`Card` renders a plain `div`);
  existing tests are label/role/text based so the wrapper doesn't break selectors, borne
  out by the full test run.
- All five planned edge cases (no-due-date sort, unchanged date-only round-trip, unchanged
  date+time round-trip, clearing on update, midnight-heuristic limitation, missing-field
  fixture) have corresponding test coverage in the diff, matching plan.md §4 exactly.

No blocking findings. This diff does what the ticket and plan describe, is scoped
correctly against the three unmerged sibling PRs, and the two claims singled out for
extra scrutiny (Prisma null-ordering syntax, the type-widening rationale) both check out
under direct verification rather than by trusting the plan's/commit's prose.

VERDICT: APPROVED

## reviewer-code — round 2

Scope per `AGENT_RULES.md`'s re-review rule: reviewed only the fix commit
`git diff 08bd08a...583ce65` (the CalendarPopup-compatibility fix), not a full re-audit —
round 1's findings on d0e3f82 stand. Per the orchestrator's note, didn't independently
re-run lint/typecheck/build (CI already green on 583ce65 per `gh pr checks 45`); did run
`npm run -w apps/web test -- --run` (26 files / 329 tests pass) and the isolated
`task-list-item` file to confirm the specific new/changed tests actually pass, not just
trust the commit message.

### 1. No other production code changes snuck in — confirmed

`git diff 08bd08a...583ce65 --stat` touches exactly two files:
`task-list-item.tsx` (+13/-6 net) and `task-list-item.test.tsx`. Diffing against every
other path in the repo (`git diff 08bd08a...583ce65 -- . ':!apps/web/src/routes/task-list-item.tsx' ':!apps/web/src/routes/task-list-item.test.tsx'`)
returns empty. The `task-list-item.tsx` change is exactly the "Clear due date" button plus
the wrapping `flex` div — no unrelated refactor, no drive-by change elsewhere.

### 2. "Clear due date" placed at the call site, not in the shared component — right call

Confirmed the gap is real, not invented: read `calendar-popup.tsx` in full — `commitDay`
is the only path that calls `onChange`, there is no clear/reset affordance anywhere in the
popup, trigger, or grid. Checked every other consumer of `DateTimePicker`
(`task-create-form.tsx`, `ui-demo-page.tsx`) — `task-create-form.tsx` only ever starts from
an empty due date and submits once, so it never exercises a "clear an already-set date"
path; nothing else in the tree needs it either. So the commit message's claim ("no other
existing call site sets a date and later clears it") checks out.

Given that, doing this locally in `task-list-item.tsx` rather than reaching into
`calendar-popup.tsx`/`date-time-picker.tsx` is the right scope call for a fix round whose
job is "restore compatibility with the merged component," not "extend the shared
component library's feature set." `CalendarPopup`/`DateTimePicker` are owned by a separate,
dedicated ticket lineage (`select-datepicker-refactor`, `date-time-picker`) — reaching into
those files here would be exactly the kind of unrequested-scope expansion this checklist
flags, and would still need its own design pass (where does a "clear" affordance belong in
the popup: a button in the popup footer? a keyboard shortcut? clearing via re-clicking the
selected day?) that a fix commit for an unrelated CI failure shouldn't be making unilaterally.
The local `editDueDateValue.date && <Button>...` gating is simple, correct (verified by
reading `task-list-item.tsx` lines 100-117), and doesn't block a future shared-component fix
from superseding it. Non-blocking observation: this does mean `task-create-form.tsx` still
has no way to un-pick a due date before creating a task — pre-existing, out of scope for
this ticket, and correctly not addressed here (matches plan.md §5's general pattern of not
retrofitting sibling call sites).

### 3. Test updates genuinely exercise the new UI — confirmed, not weakened

Read every changed assertion in `task-list-item.test.tsx`:
- Pre-fill assertions now click the trigger `getByRole("button", { name: "Edit due date" })`
  is gone — actually assertions now read `toHaveTextContent("Jul 26, 2026")` directly off the
  closed trigger button (no need to open the popup to see the selected value, matching
  `CalendarPopup`'s own trigger-label rendering) — this is the same pattern already
  established in `task-create-form.test.tsx` (`getByRole("button", { name: "Due date" })...toHaveTextContent(...)`),
  confirmed by grepping that file directly rather than trusting the commit message's claim.
- The two tests that actually *pick* a date (`Save sends the edited due date...` and the
  inline-error-preserves-due-date test) now do the real interaction: click the trigger to
  open the popup, then click a `gridcell`. Both correctly freeze time
  (`vi.setSystemTime(new Date(2026, 6, 1))`) so the popup's default view is a known month
  and clicking `gridcell "26"` deterministically resolves to `2026-07-26` — verified this
  isn't a coincidental pass by reading `CalendarPopup.openPopup()`: with an empty `value`,
  `parsedValue` is null so it falls back to `todayParts()`, i.e. the faked system date's
  month, so the test's own reasoning (in its added comment) matches the implementation.
  Ran this specific test file in isolation (39/39 pass) and the full web suite (329/329) to
  confirm, not just read the diff.
- The clearing tests now click the new "Clear due date" button instead of
  `fireEvent.change(...,  { target: { value: "" } })` on a native input that no longer
  exists post-#40 — this is a like-for-like swap of interaction mechanism for the same
  assertion (`dueDate: null` in the save payload / cancel discards it), not a weakening.
  The new dedicated "Clear due date button resets the trigger to empty and hides itself,
  without saving" test additionally asserts `fetchImpl` was never called and the button
  itself disappears after clearing (`queryByRole(...)).not.toBeInTheDocument()`), which is
  a real, non-tautological check of the button's own visibility-gating logic, not just of
  the pre-existing save/clear payload behavior.

None of the changed tests were deleted, skipped, or loosened to `toBeInTheDocument()`-only
checks where a stronger assertion existed before — text-content/payload equality assertions
are preserved throughout.

### 4. Minor observation (non-blocking)

`Button` props used (`variant="secondary" size="sm"`) are valid per `button.tsx`'s exported
`ButtonVariant`/`ButtonSize` unions — checked directly, not assumed.

No blocking findings in the fix commit. It's correctly scoped to restoring compatibility
with the merged `CalendarPopup`, the new "Clear due date" affordance is a reasonably-scoped
local fix for a real, verified gap rather than a workaround masking a shared-component
defect that this ticket should have fixed instead, and the test rewrites are faithful
translations of the same assertions onto the new UI, not weakened coverage. CI is green on
583ce65 (`gh pr checks 45` → `build: pass`), consistent with the local full-suite run
(329/329).

VERDICT: APPROVED
