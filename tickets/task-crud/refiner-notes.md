# Refiner notes: task-crud

## Round 1

Verified against `gh issue view 4` and the actual codebase (`apps/server/src/services/task-service.ts`,
`apps/server/src/routers/task-router.ts`, `apps/web/src/components/ui/date-time-picker.tsx`,
`apps/web/src/components/ui/checkbox.tsx`, `apps/web/src/routes/tasks-page.tsx`, existing test files,
installed `zod@4.4.3` behavior tested directly with `node -e`). Overall scope framing is sound: four
mutations matching the issue's four named verbs, hardcoded to `kind: "task"`, no schema change, no
events/tags/notes — this maps cleanly to the issue text and to `AGENT_RULES.md`'s existing-pattern
conventions (thin tRPC procedures, OOP service, string-not-Date wire contract, no superjson). The
plan's own "judgment calls" section (§6) already surfaces the two biggest interpretive choices
(explicit-value `toggleComplete`, non-atomic existence check) honestly, with correct reasoning. That
transparency is good and I don't have a different take on either — flagging one real gap and one
inaccurate technical claim below.

### Finding 1 (should fix before implementation) — `TaskListItem` has no error-state handling or tests for 3 of its 4 mutation paths

`TaskCreateForm` (§3.8) explicitly designs for `createMutation.isError` (inline error message, fields
preserved). `TaskListItem` (§3.9) uses three more mutations — `toggleComplete`, `update`, `delete` —
and none of them get any `isError` handling in the plan, nor a corresponding test in §4's edge-case
list. This isn't hypothetical: the service layer's own edge-case list (§4) requires `NOT_FOUND` to be
a real, tested failure path for `update`/`toggleComplete`/`delete` (e.g. a `delete` racing another
`delete`, per the plan's own TOCTOU discussion in §3.3/§6.2). Today, if any of these three mutations
reject, the UI just silently does nothing — click "Delete", confirm, and if the row was already gone,
nothing visibly happens and the row stays in the list with no indication anything went wrong. Given
the plan already treats `NOT_FOUND` as a first-class, tested failure mode at the service/router layer,
leaving zero UI/test coverage for what the user sees when that failure reaches the client is an
inconsistency within the same ticket, not a stylistic nitpick — please add at least a minimal
`isError` render (mirroring `TaskCreateForm`'s pattern) for these three mutations, and matching test
cases in §4's `TaskListItem` list.

### Finding 2 (non-blocking, but the plan's own text is wrong) — §3.1's "Prisma will simply error on an Invalid Date" claim doesn't hold for many calendar-invalid inputs

Verified directly (`node -e`): `new Date("2026-02-30")` does **not** produce an Invalid Date — it
silently normalizes to `2026-03-02T00:00:00.000Z`. Same for `"2026-04-31"` → `2026-05-01`. Only some
malformed strings (e.g. the plan's own example, `"2026-13-45"`, where the month is also out of range)
happen to produce a genuine Invalid Date. So the documented limitation in §3.1 — "Format validity
(regex) is checked; calendar validity... is not... Prisma will simply error on an Invalid Date in that
case" — is not accurate as a general claim: a regex-valid-but-calendar-invalid `dueDate` string like
`"2026-02-30"` will silently persist as a *different, wrong* date rather than erroring at all. In
practice this is low-risk exactly as the plan says (only reachable via a direct API call bypassing the
native `date`/`time` inputs, which always produce calendar-valid values) — I'm not asking for
calendar validation to be added, just for §3.1's reasoning to be corrected so it doesn't misstate what
actually happens (a future reader relying on "Prisma will error" as a safety net would be wrong).

### Minor observations (not blocking, no action required unless convenient)

- `dueDatePayload` (§3.7) silently drops a time-without-date entry (`{ date: "", time: "14:30" }` →
  `undefined`, discarding the time silently). Given `DateTimePicker` lets a user toggle "Add time" on
  before typing a date, this is reachable through the real UI, not just a hypothetical. Probably the
  right behavior (a time with no date isn't a valid due date), but the plan doesn't call this out as a
  deliberate choice the way it does for other edge cases — worth a one-line mention alongside §3.7's
  existing edge-case list rather than leaving it implicit.
- `task.completed ?? false`'s defensive default (§3.9) is described as needed for "partial/legacy-shaped"
  fixtures, but every real `tasks.list` response has `completed: boolean` (schema default, never
  optional) — this default can't actually trigger against real server data, only against the test's own
  simplified fixtures. Harmless, just flagging that the stated rationale ("crash on a partial/legacy-shaped
  row") slightly overstates the real-world risk; it's fine to keep for the test-fixture reason alone.

### Scope check (no findings)

- Stays out of notes/tags/events as claimed — verified `updateInput`/`createInput` have no `notes`,
  `tags`, or `kind`-spoofing fields, and no eventsRouter work is proposed.
- "Unblocks everything else in the backlog" (issue text) is satisfied at the level the issue itself
  scoped it to ("Entry model (kind: task)") — checked `gh issue list`: #5 (Notes), #6 (Tags), #7
  (Events) are separately tracked and correctly left untouched; #8 (Task list view) is the existing
  `TasksPage` this ticket is extending, so the dependency chain holds.
- `toggleComplete`'s explicit-`completed` semantics vs. a server-side flip (§6.1): agree with the
  plan's own reasoning (idempotency, matches how a controlled checkbox already knows its next value)
  and don't have a different take — already surfaced as a flagged, non-blocking judgment call.

VERDICT: REVISE

## Round 2

Re-verified both round-1 findings against the actual revised `plan.md` text (not just the
changelog in §7), plus a fresh look at the rest of the plan and the current codebase
(`apps/server/src/services/task-service.ts`, `apps/server/src/routers/task-router.ts`,
`apps/web/src/trpc.ts`, `apps/web/src/routes/tasks-page.tsx`, `apps/web/src/components/ui/checkbox.tsx`,
`apps/web/src/components/ui/date-time-picker.tsx`, `apps/server/prisma/schema.prisma`, both
existing test files). No new blocking findings.

### Round-1 finding 1 (TaskListItem error handling) — adequately addressed

Read the actual §3.9 text, not just §7's summary. The revision adds a concrete, per-mutation
spec — `toggleCompleteMutation.isError`, `deleteMutation.isError`, `updateMutation.isError` each
get a stated rendering location and behavior (inline paragraph; "stay in edit mode with
`editTitle` untouched" for the update-failure case specifically, mirroring `TaskCreateForm`'s
"don't discard what the user typed" precedent). §4's `TaskListItem` edge-case list was updated
in lockstep with three explicit new test descriptions (mocked `NOT_FOUND` for toggle/update/delete,
each stating what should and shouldn't happen to on-screen state). This isn't a hand-wavy "add
error handling" — it's specific enough that an implementer doesn't need to improvise the UX. Gap
closed.

### Round-1 finding 2 (§3.1 Prisma/Date claim) — adequately addressed, independently re-verified

Re-ran the exact check myself (`node -e`): `new Date("2026-02-30")` → `2026-03-02T00:00:00.000Z`,
`new Date("2026-04-31")` → `2026-05-01T00:00:00.000Z`, `new Date("2026-13-45")` → `Invalid Date`.
All three match the plan's revised §3.1 text exactly. The revised text also correctly narrows the
old "Prisma will error" claim to the accurate scope (only out-of-range *month* values reliably
produce a genuine `Invalid Date`; day-of-month overflow silently normalizes) rather than
overcorrecting into a new inaccurate generalization. Good.

### Minor observations (§3.7, §3.9) — confirmed present, no further action needed

Read the actual text: `dueDatePayload`'s time-without-date drop is now an explicit "Deliberate,
documented behavior" paragraph in §3.7 (not just a §7 changelog line), and §3.9's
`task.completed ?? false` rationale now correctly states the default can't trigger against real
`tasks.list` data, only against simplified test fixtures. Both match what round 1 asked for.

### Fresh look — nothing rises to blocking

- **No `isPending`-based button disabling on `TaskListItem`'s three action buttons** (toggle
  checkbox, Edit/Save, Delete), unlike `TaskCreateForm`'s explicit "submit button disabled while
  `createMutation.isPending`" (§3.8). A fast double-click on Delete, for instance, could fire two
  `delete` calls before the first's invalidation lands. Traced through the likely outcome: the
  browser's `window.confirm()` is a blocking, modal call, so a true double-click can't queue two
  confirms back-to-back; a second confirm+delete after the first already resolved would 404 on
  the (now-vanished) row, but by then the list has already re-rendered without that row, so the
  `TaskListItem` instance holding the second mutation's error state has unmounted — no visible
  symptom, just a harmless wasted request. For the checkbox, the plan's own explicit-value (not
  flip) design for `toggleComplete` (§3.2) already makes rapid repeated clicks idempotent by
  construction. Net: real gap relative to `TaskCreateForm`'s pattern, but low-consequence given
  the app's current single-user scale and the mutations' own idempotency/unmount behavior — worth
  a one-line mention if this plan is touched again, not worth a third refinement round over.
- **No client-side guard against submitting an emptied-out title from `TaskListItem`'s edit
  mode**, unlike `TaskCreateForm`'s explicit pre-`mutate()` empty/whitespace guard (§3.8). Traced
  the actual consequence: `updateInput.title` is `z.string().trim().min(1).optional()`, so an
  emptied `editTitle.trim()` sent as `title: ""` fails Zod validation server-side, which now
  surfaces through the exact `updateMutation.isError` handling added for round-1 finding 1 —
  inline message, edit mode stays open, `editTitle` preserved. So this "gap" is already covered
  by the round-1 fix as a side effect, just via a server round-trip instead of an instant
  client-side block. Not a correctness issue; not asking for a change.
- Checked `apps/server/prisma/schema.prisma` directly against every field the plan references
  (`title` non-nullable, `dueDate DateTime?`, `completed Boolean @default(false)`, `kind: Kind`
  enum) — matches §2/§3.2/§3.3 exactly, no schema-change is in fact needed as claimed.
- Checked `DateTimePicker`'s actual toggle logic (`components/ui/date-time-picker.tsx`) — a user
  really can reach `{ date: "", time: "14:30" }` through the real UI (toggle "Add time" on before
  ever touching the date input), confirming §3.7's callout is describing a real, not
  hypothetical, path.
- Scope re-check: still no `notes`/tags/events touched anywhere in the plan; `create`/`update`
  Zod schemas still have no path to spoof `kind` or preset `completed` on creation. No
  scope-creep or scope-loss introduced by the round-1 revisions themselves.

Nothing found here meets the bar of "an engineer would build the wrong thing" or "a real
correctness/data-integrity risk" — the two items above are UX-polish observations, already
either harmless-by-design or already covered by the round-1 fix's own side effects. Given this is
the last refinement round, I'm not holding the plan for either.

VERDICT: APPROVED
