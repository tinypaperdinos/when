# Review notes (code): task-crud

## reviewer-code — round 1

Reviewed `git diff main...feat/task-crud` (commits 802ba50, a7abf61) against
`gh issue view 4`, `tickets/task-crud/plan.md` (post round-2-approved), and
`tickets/task-crud/refiner-notes.md`. Ran both test suites, checked CI (`gh pr checks 31`
— `build` green, which covers lint/typecheck/test/build per `AGENT_RULES.md`), and, since
this is round 1 (not a re-review round), additionally exercised the real server at
runtime: started `apps/server` against its real SQLite dev db and hit `create`, `update`,
`toggleComplete`, `delete` via `curl`, including failure paths (double-delete →
`NOT_FOUND`, update of unknown id, empty title, malformed `dueDate`) — all behaved exactly
as the plan and code predict, no divergence between unit-test mocks and real Prisma
behavior.

### Scope fidelity vs. `ticket.md`/issue #4

Issue #4 asks for create/update/delete/complete-toggle tRPC procedures on `Entry`
(`kind: task`) plus minimal `apps/web` forms. The diff delivers exactly this and nothing
more:
- `tasksRouter` gains `create`/`update`/`toggleComplete`/`delete`, each a thin
  Zod-validated procedure delegating to new `TaskService` methods — matches
  `AGENT_RULES.md`'s "thin procedures, OOP service" convention and plan §3.2/§3.3
  verbatim (verified the actual diff against the plan's code blocks — they match almost
  line-for-line).
- No `notes`, no tags, no `kind`-spoofing surface, no `eventsRouter` work — confirmed by
  reading `createInput`/`updateInput` directly.
- `apps/web` grows exactly two new components (`TaskCreateForm`, `TaskListItem`) built
  from existing `components/ui/` primitives, no new generic primitive introduced, no new
  route, no new dependency in either `package.json` — matches plan §3.12's "not touched"
  list.
- No Prisma schema/migration changes, as promised.

**On the flagged deviation** (`TaskCreateForm` renders above all of `TasksPage`'s
loading/error/empty/list states, visible even while the list is loading/erroring):
this is not actually a deviation from the plan's text — plan §3.11 says verbatim
"`TasksPage` renders `<TaskCreateForm />` above the existing loading/error/empty/list
states," and the diff does precisely that (`<TaskCreateForm />` unconditionally, then the
loading/error/empty/list branches). Nothing in `ticket.md`/issue #4 or the plan says the
form should be gated on the list's own load state. It's also better behavior, not worse:
a list-fetch failure (transient network blip, etc.) shouldn't block the ability to create
a task, and a successful `create` calls `invalidateQueries` on `tasks.list` regardless of
that query's prior state, so a stuck error/loading state self-heals once a create
succeeds. **Verdict: acceptable, not a problem — non-blocking, no action needed.**

### Correctness

No blocking correctness issues found. Specifically checked, against the plan's own edge
case list (§4) and the service code:
- `create`/`update`/`toggleComplete`/`delete` all correctly hardcode/guard `kind: "task"`
  via `assertTaskExists`, confirmed live against real Prisma (an `update`/`delete`/
  `toggleComplete` on an unknown or wrong-kind id 404s with `NOT_FOUND`, verified via
  curl, not just the mocked-db unit tests).
- `dueDate` wire contract (`undefined` = don't touch/none, `null` = clear,
  `"YYYY-MM-DD[THH:mm]"` = set) round-trips correctly end-to-end (create with a date,
  update to clear it, update to change it — all verified live).
- `title.trim()` happens both client-side (`TaskCreateForm`'s pre-`mutate` guard) and
  server-side (Zod `.trim().min(1)`), consistent with plan §3.2/§3.8.
- `toggleComplete` sends the checkbox's *new* value (`e.target.checked`), not a re-read
  of `task.completed` — verified in `task-list-item.test.tsx` ("toggling the checkbox
  calls toggleComplete with the checkbox's new value, not the old one") and matches the
  plan's explicit-value, idempotent design (§3.2/§6.1).
- All three of `TaskListItem`'s mutations (`toggleComplete`, `update`, `delete`) have
  `isError` handling with tests for the exact scenarios refiner-notes round 1 flagged as
  missing (failed toggle leaves checkbox unaffected; failed update stays in edit mode
  with `editTitle` preserved; failed delete leaves the row present) — this was the plan's
  own round-1 fix, and it's fully implemented and tested, not just partially addressed.
- Every edge case in plan §4 (`task-service.test.ts`, `task-router.test.ts`,
  `task-due-date.test.ts`, `task-create-form.test.tsx`, `task-list-item.test.tsx`,
  `tasks-page.test.tsx`) has a corresponding test; spot-checked several against the real
  server rather than trusting the mocks alone (see above).

### Design

Fits existing codebase conventions well:
- Thin router / fat service split preserved; `assertTaskExists` private helper avoids
  duplicating the existence/kind check across three methods.
- `Task` type derivation in `apps/web/src/trpc.ts` follows the "never hand-write a manual
  type for API responses" rule, matches plan §3.6.
- `dueDatePayload` is a small colocated-tested pure helper under `src/lib/`, matching the
  `cn.ts` precedent, as the plan calls for.
- Both new web components consume existing `components/ui/` primitives
  (`TextInput`/`Checkbox`/`Button`/`DateTimePicker`) with no new low-level primitive,
  matching the ticket's "minimal forms" framing.

No unnecessary abstraction introduced, no copy-pasted logic that should be shared instead
(the invalidate-list-on-success pattern is repeated three times in `TaskListItem` but is
a one-line `queryClient.invalidateQueries` call already factored into a local
`invalidateList()` helper — reasonable, not worth extracting further for three call
sites).

### Simplification

Nothing found that's clearly simplifiable without losing correctness. The two items
`refiner-notes.md` round 2 already surfaced as low-priority, non-blocking observations
still apply to the shipped code and I re-confirm them here rather than treat them as new
findings:
- **Non-blocking**: no `isPending`-based disabling on `TaskListItem`'s Delete/Edit/
  checkbox controls (unlike `TaskCreateForm`'s submit button). Given `window.confirm` is
  blocking and `toggleComplete` is idempotent by design, the realistic failure mode is a
  harmless double-request, not a data-integrity bug — matches the refiner's own risk
  assessment. Not asking for a change.
- **Non-blocking**: a raw Zod-validation error message (a JSON-stringified issue array)
  would surface verbatim in `TaskListItem`'s inline error paragraph if a direct/malformed
  request ever hit a validation failure post-existence-check (e.g. emptied-out edit title
  going through the server round trip). Reachable in principle through the UI's own edit
  flow (an all-whitespace edit), so worth a one-line note for a future ticket that wants
  nicer error copy, but not a scope requirement here and not something the plan asked to
  be fixed.

### Summary

Implementation is a faithful, well-tested realization of the (twice-refined,
already-approved) plan. No missed requirements, no unrequested scope, no correctness
bugs found either in the unit tests or in live verification against the real server.

VERDICT: APPROVED

## reviewer-code — round 2

Scope per `AGENT_RULES.md`'s re-review rule: reviewed only `git show 27a1534`, the fix
commit for reviewer-tests round-1's blocking finding (untested title-trimming/whitespace-
rejection at the router layer).

- **Confirmed test-only**: diff touches exactly `apps/server/src/routers/task-router.test.ts`
  (+52) and `apps/server/src/services/task-service.test.ts` (+1/-1, rename only) — no
  production code changed.
- **Confirmed it targets the finding correctly**: the two new `create`/`update` "trims a
  padded title before it reaches TaskService.*" tests go through `createCaller` (the real
  router + Zod schema), not a direct service call as the old, misleadingly-named
  `task-service.test.ts` test did — this is exactly the layer the round-1 finding said was
  untested. The two new "rejects a whitespace-only title" tests cover the other half of
  the finding (a `"   "` title previously passed `.min(1)` unnoticed without `.trim()`).
- **Confirmed non-tautological**: commit message states mutation testing was performed
  (removed `.trim()` from both schemas, confirmed exactly these 4 new tests fail, restored,
  confirmed 38/38 pass). Re-ran `npm run --workspace apps/server test` on the current
  branch tip independently: 38/38 pass, 3 test files, consistent with the commit's claim.
  Did not repeat the mutation experiment myself since the commit message already documents
  it and `AGENT_RULES.md`'s re-review rule says one reviewer reproducing a self-reported
  mutation check is enough.
- **Rename**: `task-service.test.ts`'s test name changed from "trims a padded title before
  persisting" (which asserted the opposite — no trimming) to a name that states the service
  is a pass-through and points to where trimming is actually tested. No assertion changed,
  purely a label fix; matches the commit message.
- No new issues introduced. No scope creep — nothing beyond the 4 new tests + 1 rename the
  fix was scoped to.

VERDICT: APPROVED
