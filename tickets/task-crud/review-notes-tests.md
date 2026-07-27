# review-notes-tests

## reviewer-tests — round 1

Reviewed `git diff main...feat/task-crud` (commits `802ba50`, `a7abf61`) against
`tickets/task-crud/plan.md` §4's edge-case list and `gh issue view 4`. Verification method:
read every changed test file, cross-checked each plan §4 bullet against an actual test
case, and — for the behaviors most likely to be asserted tautologically — mutated the
implementation (removed a check / a conversion / an error-render block) and re-ran the
relevant test file to confirm it actually fails, then restored the file via `git status`/
diff to confirm no residual changes. `npm run --workspace apps/server test` (34/34) and
`npm run --workspace apps/web test` (151/151) both pass on the unmodified branch.

### Blocking

**Title trimming is untested at the layer where it actually happens, and the one test
labeled "trims" tests the opposite.** Per plan §3.2, trimming is implemented via Zod's
`z.string().trim().min(1, ...)` on `createInput`/`updateInput` in
`apps/server/src/routers/task-router.ts` — `TaskService.create`/`update` never call
`.trim()` themselves; they just persist `input.title` as received *after* the schema has
already parsed it.

- `task-service.test.ts`'s `"trims a padded title before persisting"` test (lines 61-74)
  calls `service.create({ title: "  Buy milk  " })` **directly**, bypassing the router/Zod
  layer entirely, and asserts `db.entry.create` was called with `title: "  Buy milk  "` —
  i.e. still padded. The assertion's own name says "trims" but the assertion itself proves
  the service does *not* trim. This test would pass identically whether or not `.trim()`
  exists anywhere in the codebase — it isn't testing the trimming behavior the plan asked
  for, just documenting (accurately, but under a misleading name) that the service is a
  pass-through.
- `task-router.test.ts` has no test that sends a padded title through `createCaller` and
  asserts the value reaching `TaskService.create`/`update` (i.e. the mocked `db.entry.create`/
  `update` call) is trimmed.
- Verified by mutation: removed `.trim()` from both `createInput.title` and
  `updateInput.title` in `task-router.ts` (kept `.min(1)`) and reran
  `task-router.test.ts` + `task-service.test.ts` — **30/30 still pass**. This is exactly
  the "test that passes against both old and new/reverted code" pattern this review is
  meant to catch (and the exact failure mode called out re:
  `tickets/date-time-picker/review-notes-code.md`).
- A related, more concrete consequence of the same gap: without `.trim()`, `z.string().min(1)`
  accepts a whitespace-only string like `"   "` as a valid title (verified directly: `z.string().min(1).parse("   ")` returns `"   "` unchanged, no error) — meaning the plan's own
  explicitly-required case, **"rejects empty/whitespace-only title,"** is only tested for the
  empty-string half (`task-router.test.ts`'s `"rejects an empty title"` uses `title: ""`)
  and never for the whitespace-only half. A regression that dropped `.trim()` would let a
  task titled `"   "` (or worse, `"   New title   "`, un-trimmed) get created/updated
  silently, and no test in the diff would catch it.

Fix suggestion (test-only, no implementation change needed — the implementation is
correct): add a `task-router.test.ts` case that calls
`caller.tasks.create({ title: "  Buy milk  " })` and asserts `create` was called with
`title: "Buy milk"` (trimmed), plus a case asserting `caller.tasks.create({ title: "   " })`
(whitespace-only, non-empty) is rejected the same way the existing empty-string case is.
Mirror both for `update`. Optionally rename/rescope the misleading `task-service.test.ts`
"trims" test so it isn't asserting the opposite of its own name (e.g. rename to something
like "passes the title through unchanged — trimming happens upstream in the Zod schema,
tested in task-router.test.ts").

### Non-blocking / confirmed-adequate (no action required)

The following plan §4 requirements were checked and, where feasible, mutation-tested —
all correctly implemented and covered:

- `dueDate` conversion (create: omitted → `undefined`; date-only and date+time strings →
  real `Date`; update: title-only → `dueDate: undefined` untouched, explicit `null` →
  clears, valid string → converts/sets) — all present in `task-service.test.ts` with
  exact-`data`-object assertions (not `objectContaining`) for the conversion cases, which
  is the right level of strictness. Verified by mutation: removing the `new Date(...)`
  conversion in `create` and dropping the `assertTaskExists` call in `delete` each broke
  the corresponding test(s) as expected.
- `NOT_FOUND` for missing id and for a wrong-kind (`kind: "event"`) id — covered for
  `update`, `toggleComplete`, and `delete`, each also asserting the downstream `db` mutation
  method (`update`/`delete`) was *not* called, which is the right assertion (proves the
  guard runs before the mutation, not just that an error was thrown from somewhere).
- `toggleComplete` idempotency (`"is idempotent: calling it twice with completed: true..."`)
  — present and matches the plan's literal ask; note it can't distinguish a genuine "set"
  implementation from a hypothetical "flip-based-on-a-frozen-mock's-stale-`completed`-field"
  implementation, since the fake `findUniqueResult` doesn't change between the two calls —
  but that's a contrived alternate implementation, not a realistic regression risk, and the
  test does match what the plan asked for. Not blocking.
- Zod validation rejection at the router level — one rejection case per new procedure
  (`create`: empty title; `update`: malformed `dueDate`; `toggleComplete`: missing
  `completed`; `delete`: empty id), each also asserting the underlying `db` method was not
  called. Matches plan §3.5/§4's stated scope (deep edge cases live in the service test,
  router test proves wiring).
- `dueDatePayload`'s deliberate time-without-date drop — has its own explicit test case
  (`task-due-date.test.ts`), distinct from the "empty date" case, exactly as plan §4 called
  for.
- `TaskListItem`'s three error paths added in the plan's round-1 revision
  (`toggleComplete`/`update`/`delete` `isError` handling) — all three present in
  `task-list-item.test.tsx` and verified by mutation: removing the three `isError`-rendering
  JSX blocks from `task-list-item.tsx` causes exactly those three new tests to fail (3
  failed / 10 passed), with no other test collateral damage. These are real,
  would-catch-a-regression tests, not tautologies. `TaskCreateForm`'s error-handling test
  (the pattern these three mirror) was likewise checked and is asserting real rendered
  output (`screen.findByText(...)`) plus the preserved-input-value assertion, not just that
  a mock was called.
- `TasksPage` regression coverage (loading/error/empty-list) is unchanged in intent and
  still passes; the populated-list fixture was updated to a full `Entry`-shaped row per
  plan §3.11, and the create-form-renders-alongside-list case is present.

### Scope check

No test asserts on `notes`, tags, or event-kind entries; nothing tests due-date *editing*
via `TaskListItem` (correctly excluded per plan §4's explicit "not planned as a dedicated
test" list, §3.10). No test coverage gap found for anything in plan §5's explicit
non-goals list — consistent with the ticket.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scoped to the fix commit `27a1534` only, per the re-review scope rule, checking whether
it closes the round-1 blocking finding (title trimming/whitespace-only rejection
untested at the router level; misleadingly-named service test).

**Round-1 finding: closed.**

- `apps/server/src/routers/task-router.test.ts` now has all 4 promised cases: `create >
  rejects a whitespace-only title`, `create > trims a padded title before it reaches
  TaskService.create`, `update > rejects a whitespace-only title`, `update > trims a
  padded title before it reaches TaskService.update`. Each sends input through
  `appRouter.createCaller({})` (the real Zod schema), not the service directly, so they
  exercise the exact layer the round-1 finding identified as untested.
- Independently reproduced the fixer's mutation-testing claim rather than trusting the
  commit message: removed `.trim()` from both `createInput.title` and
  `updateInput.title` in `task-router.ts` (kept `.min(1)`), reran
  `npm run --workspace apps/server test`. Result: **exactly the 4 new tests fail, 34
  still pass** (`4 failed | 34 passed (38)`) — the failing test names are precisely the
  4 listed above, no collateral failures and no false negatives elsewhere. Restored the
  file via `git checkout --`, confirmed `git diff --stat` shows no residual change, and
  reran the suite: **38/38 pass**, matching the pre-mutation baseline. This confirms the
  new tests are load-bearing (would catch a reintroduced/dropped `.trim()`), not
  tautological.
- The whitespace-only-title service-level gap (a bare `.min(1)` accepting `"   "`) is now
  covered at the layer where the behavior actually lives (Zod schema in the router), not
  the service — correct per how the round-1 finding characterized the bug.
- `task-service.test.ts`'s test rename (`"trims a padded title before persisting"` →
  `"passes the title through unchanged — trimming happens upstream in the router's Zod
  schema, tested in task-router.test.ts"`) is assertion-identical (confirmed via `git
  show 27a1534` diff — only the string literal changed) and resolves the naming
  contradiction flagged in round 1: the name no longer claims trimming behavior that this
  test doesn't and shouldn't assert.
- No other files changed in this branch since round 1 (`git log --oneline
  main..feat/task-crud` shows only `802ba50`, `a7abf61`, and this fix commit
  `27a1534`), consistent with a scoped, minimal fix — no new surface introduced that
  needs separate review.

No new findings. Round-1 blocking finding is fully resolved with verifiable,
non-tautological coverage.

VERDICT: APPROVED
