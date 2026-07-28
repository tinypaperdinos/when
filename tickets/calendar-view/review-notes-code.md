## reviewer-code — round 1

Reviewed `git diff main...feat/calendar-view` (commit f80e560) against `ticket.md`
(issue #9) and `plan.md`. Ran locally: `npm run --workspace apps/web test -- --run`
(224/224 passed), `npm run --workspace apps/web typecheck` (clean), `npm run --workspace
apps/web lint` (clean), `npm run --workspace apps/web build` (succeeds). PR #42 CI
(`gh pr checks 42`) was still `pending` at review time, so these were run explicitly
rather than trusted.

### Scope fidelity vs. ticket.md / plan.md

- `apps/server` untouched — confirmed via `git diff main...feat/calendar-view -- apps/server`
  (empty output). Matches plan §1's "no backend changes" boundary.
- `/calendar` route added and reachable via a new persistent nav in `root-route.tsx`
  (`Tasks` / `Calendar` links) — matches plan §3.5.
- Drag-and-drop reschedule calls the existing `trpc.tasks.update` / `trpc.events.update`
  mutations with the correct payload shapes (`{ id, dueDate }` / `{ id, date }`), built via
  `buildRescheduleMutationArgs` exactly as specified in plan §3.4. No new tRPC procedure.
- `isMidnightUtc` (`apps/web/src/lib/calendar-events.ts:17-19`) is the literal-string check
  specified in plan §3.1: `iso.endsWith("T00:00:00.000Z")`. No `new Date(iso).getUTCHours()`
  or any `Date`-object reparsing anywhere in the diff. The day-extraction in
  `entryToCalendarEvent` also uses `iso.slice(0, 10)`, not re-parsed getters, matching
  the plan's stated reasoning. Confirmed no regression to the earlier (pre-fix) approach.
- `wireDateFromDrop` uses local `Date` getters (`getFullYear`, `getMonth() + 1`, `getDate`,
  `getHours`, `getMinutes`), zero-padded, never `toISOString()` — matches plan §3.1/§3.4.
  Dedicated January test case (month `"01"` not `"00"`) present in
  `calendar-events.test.ts`, matching plan §4 edge case 9.
- Non-goals respected:
  - No `dateClick`/`select`/`eventClick` handlers anywhere in `calendar-page.tsx` — no
    calendar-initiated create, no click-to-edit modal.
  - No tag display/filtering — `extendedProps` only carries `kind`/`completed`.
  - No optimistic cache patching — only `invalidateQueries` on mutation success plus
    `info.revert()` on error, per plan §3.3.
  - `apps/web/package.json` pins `@fullcalendar/*` to `^6.1.21` (confirmed also in
    `package-lock.json`'s resolved version, `6.1.21`) — not v7.
- Visual-check claim (point 4 in the review brief): no evidence of a Playwright check is
  recorded anywhere in `tickets/calendar-view/` or the PR body/commit message, but the
  concrete thing worth verifying — whether a CSS override was silently added to route
  around a Tailwind-preflight/FullCalendar grid conflict — checks out: `git diff
  main...feat/calendar-view -- apps/web/src/index.css` is empty, and no other CSS file
  was added or modified. Non-blocking: the plan asked for this check to happen once during
  implementation; there's no durable record it happened, but the codebase artifact (no
  override present) is consistent with either "it wasn't needed" or "it wasn't done" —
  can't fully distinguish those from the diff alone, but nothing here is broken either way.

### Correctness

- `entryToCalendarEvent`, `calendarEntries`, `buildRescheduleMutationArgs` all match the
  plan's pseudocode and edge-case list (§4, items 1-9 all present and correctly
  implemented in `calendar-events.test.ts`).
- `handleEventDrop` in `calendar-page.tsx` guards `!info.event.start` with `info.revert()`
  before building mutation args — correct defensive check per plan.
- `dragError` local state (not declarative `mutation.isError`) is implemented exactly per
  plan §3.3's justification, and the "stale banner cleared by unrelated successful drag"
  test (plan §4 item 17) is present and passes.
- Completed-task styling (`eventClassNames` returning `["line-through"]`) matches plan's
  extendedProps note and `task-list-item.tsx`'s existing convention; a completed task
  remains a valid drop target (test present, item 18).
- All 224 web tests pass, including the 26 new tests across `calendar-events.test.ts` and
  `calendar-page.test.tsx`.

### Design

- `handleEventDrop` stays thin (dispatch + mutation call), with all real logic in the pure,
  unit-tested `calendar-events.ts` — matches the "thin procedure/handler, logic in a
  testable module" convention cited in the plan.
- No unnecessary abstraction; no copy-pasted logic — `wireDateFromDrop` is the one shared
  primitive both mutation-arg branches use.

### Simplification

- Nothing found worth trimming — the diff is already close to the plan's own minimal
  pseudocode, and the one piece of local state (`dragError`) that could look like
  over-engineering has a concrete correctness justification backed by a regression test.

No blocking findings.

VERDICT: APPROVED

## reviewer-code — round 2

Scoped to the fix commit `73eae1f` (the only new commit on the branch since `f80e560`,
per the re-review scope rule in `AGENT_RULES.md`). Did not re-run lint/typecheck/build
(CI already green per the orchestrator's `gh pr checks` check); ran the two touched test
files directly instead: `npm run --workspace apps/web test -- --run
src/lib/calendar-events.test.ts src/routes/calendar-page.test.tsx` → 31/31 pass,
including both new tests.

### Production-code scope check

`git diff f80e560..73eae1f --stat` touches exactly two files, both tests:
`apps/web/src/lib/calendar-events.test.ts` and `apps/web/src/routes/calendar-page.test.tsx`.
No file under `apps/web/src/lib/calendar-events.ts`, `apps/web/src/routes/calendar-page.tsx`,
or anywhere in `apps/server` is touched. Fixer's commit message claim ("test-only") is
accurate — confirmed by diff inspection, not just trusted.

### Fix content

- Finding 1 (weak `wireDateFromDrop` all-day test): fixer added a second test using a
  Date-like object whose `getFullYear`/`getMonth`/`getDate` getters and `toISOString()`
  deliberately disagree about the calendar day (local: July 28; `toISOString()`: July 27).
  This does genuinely distinguish "reads local getters" from "reads `toISOString()`"
  regardless of the suite's own timezone, unlike the original literal-`Date` test flagged
  in round 1. Commit message documents a revert-and-confirm-red step; I did not redo that
  mutation myself (per `AGENT_RULES.md`'s "don't duplicate verification" rule, and its
  reasoning is sound: reverting the one-line implementation to `toISOString().slice(0,10)`
  would make the local getters irrelevant, producing `"2026-07-27"` against the asserted
  `"2026-07-28"`). The original weaker test is left in place alongside the new one, which
  is fine — it still documents the common-case shape, and the new test now carries the
  actual regression-catching weight.
- Finding 2 (missing `eventClassNames` coverage): fixer extended the `@fullcalendar/react`
  mock to capture `props.eventClassNames` (mirroring the existing `eventDrop` capture
  pattern already in the file) and added two tests asserting `["line-through"]` for
  `completed: true` and `[]` for `completed: false`. This directly covers plan §4 edge
  case 18, matching `calendar-page.tsx`'s actual implementation
  (`eventClassNames={(arg) => arg.event.extendedProps.completed ? ["line-through"] : []}`).

### Correcting my round-1 claim

My round-1 entry stated: "Completed-task styling (`eventClassNames` returning
`["line-through"]`) matches plan's extendedProps note ... a completed task remains a
valid drop target (test present, item 18)." That was wrong — as `reviewer-tests` round 1
finding 2 correctly identified, no test exercised `eventClassNames` at all pre-fix; the
only pre-fix test for a completed task asserted its title text rendered, which says
nothing about styling. I conflated "the completed task renders (title visible)" with "the
completed task's styling is verified" — those are different assertions and only the first
was true. This is now fixed by the fix commit's two new `eventClassNames` tests. Noting
this here per the round-2 brief so the correction is on record in my own file rather than
only in `reviewer-tests`' notes.

### Scope of the fix itself

Both fixes are narrowly targeted at the two round-1 blocking findings, nothing else
changed, and neither introduces new production-code surface for scope-fidelity purposes
(no new plan.md-uncovered behavior, no new dependency, no new file outside the test
suite). Left-unaddressed non-blocking findings (3-6 in `review-notes-tests.md` round 1)
were explicitly deferred by the fixer's commit message and remain non-blocking per
`reviewer-tests`' own severity call — nothing here changes that assessment.

No blocking findings in the fix commit.

VERDICT: APPROVED
