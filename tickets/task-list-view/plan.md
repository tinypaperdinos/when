# Plan: Task list view (issue #8)

Issue #8's full text (fetched via `gh issue view 8`):

> Build the sorted-by-due-date task list as its own real page (README MVP scope),
> replacing/extending the current bare tasks-page.tsx proof-of-wiring. Needs real
> create/edit UI to link to.
>
> Depends on: Task CRUD (#4), Tags (#6), Notes on tasks (#5).
>
> Comment (SamuelEffler): Also depends on the component library (#14 setup, plus form
> primitives #15, layout #18, feedback #19) — the real list view should be built from
> shared components, not the scaffold's ad-hoc tasks-page.tsx markup.

## 0. Dependency / merge-state audit (read this before the rest of the plan)

This branch (`feat/task-list-view`) is cut from current `main`. Verified via `gh pr list`
and `git log main -- <path>` before writing this plan:

| Dependency | Issue/PR | State | On `main`? |
|---|---|---|---|
| Task CRUD | #4 / PR #31 | merged | yes |
| Tags | #6 / PR #37 | merged | yes |
| Notes on tasks | #5 / PR #32 | merged | yes |
| Component library setup, Tailwind | #14 / PR #22 | merged | yes |
| Form primitives (TextInput, Textarea, Checkbox, Select, Button icon variant) | #15 / PR #25 | merged | yes |
| Layout primitives (Section, Card, Panel) | #18 / PR #24 | merged | yes |
| Date-time picker | #16 / PR #28 | merged | yes |
| Tag input + Badge | #17 / PR #36 | merged | yes |
| **Feedback components (Modal/Dialog, EmptyState, LoadingState, Spinner)** | **#19 / PR #38** | **open, not merged** | **no** |
| **Card refactor** | **#29 / PR #39** | **open, not merged** | **no** |
| **Select/Datepicker refactor (hand-rolled calendar popup)** | **#30 / PR #40** | **open, not merged** | **no** |
| Calendar view (`/calendar` route, `calendar-page.tsx`) | #42 | open, not merged | no |

`git log main -- apps/web/src/components/ui/modal.tsx` returns nothing — the file only
exists on the unmerged `feat/feedback-components` branch. Confirmed the same way for
`card.tsx` (only the original #24 version is on `main`, not #39's refactor) and
`select.tsx`/`date-time-picker.tsx` (only the original #25/#28 versions are on `main`,
not #40's hand-rolled calendar popup).

**This plan builds against `main`'s current component APIs only**: the original `Card`
(`padding: "sm" | "md"`, plain bordered `div`), `Section`, `Panel`, the existing native
`<input type="date">`/`<input type="time">`-based `DateTimePicker`, and no `Modal`,
`EmptyState`, or `LoadingState`. It does **not** wait for or assume #38/#39/#40/#42.
Router/nav is untouched beyond this ticket's own needs — no `/calendar` link is added to
`root-route.tsx`, since that route doesn't exist on `main` yet; that's #42's job when it
merges, not this ticket's.

If #38 merges before/during this ticket's implementation, swapping the plain-text
loading/empty states for `LoadingState`/`EmptyState` and moving the inline edit form into
a `Modal` are natural, small follow-ups — flagged as out of scope below (§6), not
attempted here, so this ticket isn't blocked on someone else's open PR.

## 1. What "done" means

- `TasksPage` (`apps/web/src/routes/tasks-page.tsx`) is a real, componentized page: a
  `Section` with a "Tasks" heading, a `Panel`-wrapped create form, and the task list
  rendered as bordered `Card`s (per the layout-primitives PR's own stated intent — Card
  is "a compact bordered container for repeated list items") — instead of the current
  unstyled `<ul>`/raw-`<p>` markup. Loading/error/empty states stay plain-text (no
  `LoadingState`/`EmptyState` — not on `main`, see §0) but get the same muted-text
  treatment used elsewhere (`text-ink/60`) instead of bare `<p>`.
- The list is genuinely sorted by due date, **including a real ordering decision for
  tasks with no due date** (see §3.1 — today they sort *first*, ahead of the most urgent
  dated task, which is backwards for a "due-date sorted" list; this ticket fixes that to
  sort last).
- Editing a task's due date is now wired into `TaskListItem`'s edit mode — closing the
  gap `task-crud/plan.md` §3.10 explicitly deferred ("due-date editing is not wired to
  the UI this round... flagged as the most contestable scope cut in this plan"). A
  due-date-sorted list where you can't actually edit the due date is an obvious gap for
  *this* ticket to close, since it's the one making due-date sorting the page's whole
  point.
- Create and edit are both real, working UI backed by the already-merged `tasks.create`/
  `tasks.update` procedures — title, due date, notes, and tags all editable, no
  read-only/inert fields.
- CI (`lint`, `typecheck`, `test`, `build`) stays green.

**Explicitly not part of "done"** (see §6 for full reasoning): no `Modal`-based dialog
for create/edit (component doesn't exist on `main`), no new routes for create/edit
(`/tasks/new`, `/tasks/:id/edit`) — reasoning in §6.1, no completed-task filtering/
hiding, no notes truncation.

## 2. Context: what exists today

`apps/web/src/routes/tasks-page.tsx` already does most of the *functional* work — it's
not actually "bare" anymore (that description predates Task CRUD/Tags/Notes landing):
`TaskCreateForm` renders full create UI (title, due date via `DateTimePicker`, notes via
`Textarea`, tags via `TagInput`), and `TaskListItem` renders each task with a checkbox,
inline edit (title/notes/tags only — not due date), tag `Badge`s, notes, a due-date line,
and delete (with `window.confirm`). What's missing, matching the issue's own follow-up
comment, is that **none of it uses the shared layout components** (`Section`/`Panel`/
`Card`) — it's raw `<ul>`/`<li>`/`<p>` — and due-date editing was deliberately deferred.

Server-side, `TaskService.list()` (`apps/server/src/services/task-service.ts`) already
does `db.entry.findMany({ where: { kind: "task" }, orderBy: { dueDate: "asc" }, include:
{ tags: true } })` — due-date sorting already exists at the query level, it's just not
correct for the no-due-date case (§3.1).

Router: `apps/web/src/router.ts` has exactly one real route (`/`, `TasksPage`) plus a
dev-only `/dev/ui`. No nav bar exists yet (`root-route.tsx` only conditionally renders the
dev-ui link). This ticket doesn't add one — there's still only one real page.

## 3. Task breakdown

### 3.1 `apps/server/src/services/task-service.ts` (modified) — sort tasks with no due date last

Change `list()`'s `orderBy` from `{ dueDate: "asc" }` to `{ dueDate: { sort: "asc", nulls:
"last" } }` (Prisma's null-ordering support, stable since Prisma 4.x, no preview flag
needed — confirmed against this repo's Prisma 6.19.3). Today, SQLite's default `ASC`
ordering sorts `NULL` *before* every non-null value, so a task with no due date currently
appears above every dated task, including ones due today — the opposite of what a
"due-date sorted" list should do. Tasks with no due date should read as "whenever," i.e.
last, not "most urgent."

### 3.2 `apps/server/src/services/task-service.test.ts` (modified)

Update the existing "filters to kind: task, excluding events" test's `orderBy` assertion
to `{ dueDate: { sort: "asc", nulls: "last" } }`. Note the limitation this test suite
already has (mocked `db.entry.findMany`, no real SQLite exercised) — this only proves the
correct shape is passed to Prisma, not that Prisma/SQLite actually order nulls last at
runtime; that's trusted to Prisma's documented behavior, consistent with how this test
file already verifies every other `orderBy`/`where`/`include` shape (call-args assertions,
not integration tests against a real db).

### 3.3 `apps/web/src/lib/task-due-date.ts` (modified) — reverse conversion for editing

Add two new exports alongside the existing `dueDatePayload`:

```ts
// wire dueDate (ISO string from the server, or null) -> DateTimePickerValue, for
// pre-filling the edit form. Inverse of dueDatePayload, with the same "no part of this
// app handles timezones yet" caveat as tickets/task-crud/plan.md §3.1: a date-only
// value round-trips exactly in UTC (this repo's dev/CI timezone) but is not guaranteed
// to elsewhere; see plan.md §4 for the full reasoning, not repeated here.
export function dueDateValueFromWireDate(wireDueDate: string | null): DateTimePickerValue {
  if (!wireDueDate) return { date: "" };
  const parsed = new Date(wireDueDate);
  const date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
  return hasTime ? { date, time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` } : { date };
}

// Update-direction payload: unlike dueDatePayload (create), an empty date here means
// "clear the due date" (null), not "omit the field" (undefined) — the edit form always
// resubmits its current due-date value, so there's no "leave unchanged" case to preserve.
export function dueDatePayloadForUpdate(value: DateTimePickerValue): string | null {
  return dueDatePayload(value) ?? null;
}
```

(`pad` is a trivial local `(n: number) => String(n).padStart(2, "0")` helper, not
exported.) Colocated tests added to `task-due-date.test.ts` — see §4 for the specific
cases (date-only round-trip, date+time round-trip, null, midnight-time heuristic edge
case, clearing on update).

### 3.4 `apps/web/src/routes/task-list-item.tsx` (modified) — wire due-date editing + Card layout

- New state: `editDueDateValue: DateTimePickerValue`, initialized to `{ date: "" }` and
  set in `handleEditClick` via `dueDateValueFromWireDate(task.dueDate)` (mirrors the
  existing `editTitle`/`editNotes`/`editTags` pattern).
- Edit-mode JSX gains a `DateTimePicker` (`dateLabel="Edit due date"`,
  `timeLabel="Edit due time"`, `addTimeLabel="Edit add time"` — following the existing
  "Edit task title"/"Edit task notes"/"Edit task tags" label-prefixing convention so
  `getByLabelText` stays unambiguous alongside the create form's "Due date"/"Time"/"Add
  time" on the same page).
- `handleSave()` adds `dueDate: dueDatePayloadForUpdate(editDueDateValue)` to the
  `updateMutation.mutate(...)` call.
- Both the editing and non-editing `<li>` bodies are restyled: the inner content moves
  into a `<Card padding="sm">` (kept inside the existing `<li>` for list semantics — `Card`
  renders a `div`, so `<li><Card>...</Card></li>` is valid and keeps the list role on the
  `<li>`, not the `Card`). No behavior change from this restyle alone.

### 3.5 `apps/web/src/routes/task-list-item.test.tsx` (modified)

Extend with: due date pre-fills on Edit (date-only and date+time fixtures), Save includes
the (possibly unchanged) due date in the update payload, Save sends `dueDate: null` after
clearing the date field, Cancel discards a due-date edit without calling update. Existing
tests are unaffected by the `Card` wrapper (all current assertions are text/role/label
based, not markup-structure based) — no expected regressions there, but re-run them to be
sure once the Card wrapper lands.

### 3.6 `apps/web/src/routes/tasks-page.tsx` (modified) — page layout

- Wrap the page body in `<Section title="Tasks">`.
- Wrap `<TaskCreateForm />` in `<Panel title="Add a task">` (wrapped at this call site,
  not inside `TaskCreateForm` itself, so the form component stays layout-agnostic).
- List container becomes `<ul className="space-y-3">` (spacing between the now-bordered
  `Card`s) — `<li>`/`TaskListItem` mapping is otherwise unchanged; the `Card` itself lives
  inside `TaskListItem` per §3.4.
- Loading/error/empty-state `<p>` tags get a muted-text class (`text-ink/60`) for visual
  consistency with the rest of the design language — no text-content change (existing
  tests assert on text content via regex, e.g. `/loading tasks/i`, which still matches).

### 3.7 `apps/web/src/routes/tasks-page.test.tsx` (modified)

Add one test asserting the "Tasks" heading renders (`getByRole("heading", { name:
"Tasks" })`). All existing tests (loading/error/populated/empty/tag-badge/tag-suggestions)
should keep passing unmodified since they select on text/label/role, not raw markup —
verify this holds once §3.6's markup changes land, and fix up any that turn out to be
markup-coupled (none currently appear to be, based on reading the file).

## 4. Edge cases and error conditions

- **No due date**: sorts last (§3.1), not first — the actual bug this ticket fixes.
  Covered by a `task-service.test.ts` assertion on the `orderBy` shape (§3.2); real
  ordering behavior is trusted to Prisma, not independently verified (documented
  limitation of this repo's existing db-mocked test style, not new to this ticket).
- **Editing a date-only due date, unchanged**: `dueDateValueFromWireDate` then
  `dueDatePayloadForUpdate` on an untouched value should round-trip to the same wire
  string (e.g. `"2026-07-26"` -> `{ date: "2026-07-26" }` -> `"2026-07-26"`), in this
  repo's UTC dev/CI environment. Needs a colocated `task-due-date.test.ts` case.
- **Editing a date+time due date, unchanged**: same round-trip guarantee for e.g.
  `"2026-07-26T14:30"`.
- **Clearing a due date in edit mode**: empty date field on Save sends `dueDate: null`
  (explicit clear), not `undefined` (which the update procedure treats as "leave
  unchanged") — this is the whole reason `dueDatePayloadForUpdate` differs from
  `dueDatePayload`. Needs both a `task-due-date.test.ts` unit case and a
  `task-list-item.test.tsx` case (Save after clearing the date field).
- **Midnight-time heuristic limitation (documented, not fixed)**: `dueDateValueFromWireDate`
  can't distinguish "no time was ever set" from "the user explicitly picked 00:00" —
  both parse to local hours/minutes of `0,0` and are shown as date-only on re-edit,
  silently dropping an explicit midnight choice if the user re-saves without re-adding a
  time. This inherits the same class of gap `task-crud/plan.md` §3.1 already documents
  for date-only-vs-date+time parsing (UTC-midnight vs. local-midnight), and is left
  unfixed for the same reason: no part of this app handles timezones yet, and an
  explicitly-midnight due time is a narrow, low-impact edge case. Flagged here so it's a
  documented trade-off, not a missed case — worth one colocated test asserting the
  documented (not "correct") behavior, so a future fix has a test to update rather than a
  silent behavior change.
- **Legacy/partial task fixture missing `dueDate` entirely** (mirrors the existing
  `completed`/`tags` partial-fixture tests in `task-list-item.test.tsx`): edit mode
  shouldn't throw — `dueDateValueFromWireDate(undefined as unknown as string | null)`
  should behave the same as `null` (empty due date). Worth one defensive test matching the
  existing "defaults to ... on a partial fixture" pattern in that file.
- **Multiple tasks in edit mode simultaneously**: `getByLabelText("Edit due date")` (and
  the other "Edit ..." labels) would collide across two simultaneously-edited rows. This
  is a pre-existing limitation of the inline-edit pattern (already true for "Edit task
  title" etc. before this ticket), not introduced here — not fixing it as part of this
  ticket, noted so it isn't mistaken for a newly-introduced gap.
- **Save/toggle/delete failures**: already covered by existing inline-error tests
  (`task-list-item.test.tsx`); the new due-date field doesn't add a new failure mode
  beyond what `updateMutation.isError` already surfaces — the existing "renders an inline
  error when update fails, staying in edit mode with editTitle/editNotes preserved" tests
  extend naturally to asserting `editDueDateValue` is preserved too.
- **Empty task list / loading / error**: unchanged behavior, re-verified against the
  restyled markup (§3.7).

## 5. Out of scope (deliberate, with reasoning)

- **`Modal`/`EmptyState`/`LoadingState`** (#19/PR #38): not on `main` (§0). Create/edit
  stays inline (create form always visible above the list; edit swaps the `Card`'s content
  in place, as it already does today) rather than a dialog. Loading/empty states stay
  plain, muted text. Revisit once #38 merges — swapping these in is a small, self-contained
  follow-up, not a reason to block this ticket on someone else's open PR.
- **Card refactor (#29/PR #39) and Select/Datepicker refactor (#30/PR #40)**: not on
  `main` (§0). This plan is written against the current `Card`/`DateTimePicker` APIs;
  if either PR merges first, adapting to the new API is that ticket's/a follow-up's
  concern, not retroactively assumed here.
- **Dedicated `/tasks/new` / `/tasks/:id/edit` routes**: see §6.1 — considered and
  rejected in favor of in-page forms, as the closer reading of "own real page ... built
  from shared components" per the issue's own follow-up comment.
- **Completed-task filtering/hiding/sorting-to-bottom**: the README's MVP scope says "a
  task list sorted by due date," not "sorted by due date, then completion status" —
  completed tasks stay in their due-date-sorted position with the existing line-through
  styling. A "hide completed" toggle is a reasonable future feature, not part of this
  ticket.
- **Notes truncation/expand-collapse in the list view**: notes render in full (existing
  `whitespace-pre-wrap` behavior), which could look awkward for a very long note inside a
  compact `Card`. Not addressing truncation here — no existing precedent for it in this
  codebase, and it's a visual-polish concern separable from "is there real create/edit
  UI," which is what this ticket is actually about.
- **A page-level "no due date" grouping/heading** (e.g. a visual "No due date" section
  break): the sort-order fix (§3.1) makes these tasks land at the bottom, but they're not
  visually distinguished from a task whose due date just happens to be far in the future.
  Nice-to-have, not required by the ticket text or the README's MVP bullet.
- **Timezone-correct date handling**: explicitly out of scope repo-wide per
  `task-crud/plan.md` §3.1 (which this plan's §3.3/§4 explicitly inherits and documents
  rather than re-solves).

## 6. Open questions

### 6.1 "Real create/edit UI to link to" — in-page forms vs. dedicated routes

The issue text says the list should have "real create/edit UI to **link to**," which
could reasonably mean dedicated, navigable pages (`/tasks/new`, `/tasks/:id/edit`) rather
than the current pattern of an always-visible create form and an in-place edit toggle.

**This plan's default choice: keep in-page forms** (extend the existing pattern, styled
with shared components), for three reasons: (1) the issue's own follow-up comment frames
the gap specifically as "should be built from shared components, not... ad-hoc markup" —
i.e. a styling/componentization gap, not a routing gap; (2) there's no `Modal` on `main`
(§0) to make a routed "back to list" flow feel like a deliberate UX choice rather than a
workaround for a missing dialog; (3) adding a `tasks.get`-by-id procedure and a
found/not-found branch for direct navigation to `/tasks/:id/edit` is meaningfully more
surface area (new procedure, new route params, new not-found edge case) than this ticket
otherwise needs, for a codebase that has no other routed-CRUD precedent yet.

If the human disagrees and wants literal dedicated routes, that's a straightforward
revision: add `/tasks/new` and `/tasks/:id/edit` routes to `router.ts`, move
`TaskCreateForm`/`TaskListItem`'s edit body into full-page components, and either add a
`tasks.get` procedure or have the edit route fall back to finding the task in the already-
fetched `tasks.list` query cache (with a "task not found" fallback UI for direct-URL
access before that cache is populated). Flagging now rather than guessing, per this
pipeline's convention for genuine ambiguity.

### 6.2 Should the "sort nulls last" fix (§3.1) be part of this ticket?

It's a one-line, well-scoped fix directly tied to "sorted by due date" being the feature
this ticket delivers, and the current behavior (no-due-date tasks sorting *first*) reads
as a real bug against the README's stated intent, not a style choice. Included here rather
than filed as a separate ticket. If review disagrees, it's easy to revert to `{ dueDate:
"asc" }` and file separately.
