## reviewer-tests — round 1

Scope: PR #35 (`gh pr view 35`), commit `a287c37`, diffed against its actual base
`43bd45b` (event-crud, already merged into this branch's history). This is a pure
refactor — no test files are touched by the diff, per plan.md §2.4/§4 ("no new
`*-schema.test.ts` files," existing suite must pass unmodified). Verified against
`plan.md` §3's edge-case list by mutation-testing the implementation (temporarily
reintroducing each bug plan.md warns about, running `npm test`/`npm run typecheck`,
then reverting — working tree confirmed clean via `git status`/`git diff --stat`
after each revert).

### Confirmed clean
- `git diff 43bd45b..a287c37 --name-only` touches zero `*.test.ts` files — matches
  the plan's "no behavior change" contract.
- Full suite: `npm test --workspace=apps/server` → 86/86 passing, unmodified.
- `npm run typecheck --workspace=apps/server` passes cleanly.
- Mutation: dropping `idInput` from `updateInput`/`toggleCompleteInput` composition
  in `task-router.ts` → caught (4 and 1 tests fail respectively). The `.merge()`
  composition is genuinely tested, not just typechecked.
- Malformed date/time regex is exercised on both create and update for events, and
  on update for tasks (`task-router.test.ts:146`, `event-router.test.ts` create+update
  blocks). Empty/whitespace title, missing `completed`, empty `id`, and
  `notes: null`/`""`/`"   "` handling are all exercised for both entities and
  survive the shared-schema refactor unmodified — reverting the extraction back to
  two local copies would not change any of these outcomes, so they're real
  regression coverage, not tautologies.

### Blocking

1. **No test exercises malformed `dueDate` on task `create`** (only task `update` and
   both event `create`/`update` have this case — see plan.md §3's first bullet,
   which explicitly asks to double-check "both `task-router.test.ts` and
   `event-router.test.ts`'s malformed-date cases" for create *and* update). Verified
   by mutation: changed `taskCreateInput`'s `dueDate` field in `task-schema.ts` from
   `wireDateTimeString.optional()` to plain `z.string().optional()` (i.e. reintroduced
   exactly the "mistake in the extraction" plan.md warns about) — `npm test` still
   reports 19/19 passing in `task-router.test.ts`, 86/86 overall. This is precisely
   the risk plan.md flags as the reason the regex was centralized ("a mistake in the
   extraction breaks validation for both entities at once ... worth double-checking"),
   and the existing suite would not catch it on the create path for tasks. Add e.g.
   `it("rejects a malformed dueDate string", ...)` to the `create` describe block in
   `task-router.test.ts`, mirroring the one that already exists in `update`.

2. **The task/event date-nullability asymmetry (plan.md §2.1/§3's centerpiece edge
   case) has no direct router-level runtime test in either direction**, and the
   refactor itself increases the risk of exactly this mistake by placing
   `task-schema.ts` and `event-schema.ts` as near-mirror files where copy-paste
   could silently equalize them. Verified by two mutations, both reverted:
   - Made `eventUpdateFields.date` nullable (reintroducing the exact bug plan.md
     says "must survive the refactor unchanged") → `npm test` still shows 15/15
     passing in `event-router.test.ts`, 86/86 overall. It's only caught by
     `npm run typecheck`, and only incidentally — because `event-service.ts`
     happens to call `new Date(input.date)` without a null guard. If that
     implementation detail ever changes, this regression would ship silently.
   - Removed `.nullable()` from `taskUpdateFields.dueDate` (the opposite mistake) →
     `npm test` still shows 86/86 passing. It's only caught by `npm run typecheck`,
     again incidentally — because `task-service.test.ts` (a *service*-level test
     that bypasses the zod schema entirely) happens to contain a hand-written
     `{ dueDate: null }` literal that no longer type-checks against the exported
     `TaskUpdateInput` type.
   - In both cases, CI's `build` job would still fail (it runs `typecheck`), so this
     wouldn't reach `main` today. But there is no test that exercises the actual
     wire/schema boundary for this behavior — `caller.tasks.update({ id, dueDate: null })`
     resolving, and `caller.events.update({ id, date: null })` rejecting — so the
     safety net is two unrelated files' incidental TS shapes lining up, not a
     targeted regression test. That's fragile: a future refactor of either service
     body (unrelated to schemas) could silently remove the only thing currently
     catching this. Given plan.md names this exact asymmetry as the thing "most
     easy to accidentally" break during this refactor, recommend adding one
     `caller.tasks.update({ id: "1", dueDate: null })` resolves-successfully router
     test (there's currently only a service-level one) and one
     `caller.events.update({ id: "1", date: null })` rejects router test.

Both findings are pre-existing gaps in `task-router.test.ts`/`event-router.test.ts`
(neither file is touched by this diff), not regressions introduced by PR #35 itself —
the diff is a faithful, byte-for-byte-equivalent extraction. But per plan.md §3 these
are exactly the edge cases this ticket asked reviewer-tests to spot-check against the
existing suite, and the mutation tests above show the existing suite does not actually
pin them at the level the plan implies it does. Since the fixer for this ticket owns
only `apps/server` and the plan explicitly names these as the risk register for this
refactor, closing the gap here (rather than filing a follow-up) fits the ticket's own
scope.

### Non-blocking

- `notes` empty-string/null interpretation logic (`input.notes ? input.notes : undefined`
  on create, `input.notes === undefined ? undefined : input.notes || null` on update) is
  untouched by the diff (confirmed via `git diff 43bd45b..a287c37` — only type
  annotations changed, method bodies are byte-identical) and remains in the service
  layer, not folded into a zod `.transform()`. Already well covered by both
  `task-service.test.ts`/`event-service.test.ts` and the router-level
  empty/whitespace/null notes tests. No action needed.
- Import-cycle risk (plan.md §3's last bullet): confirmed `schema-helpers.ts` has zero
  imports and neither `task-schema.ts` nor `event-schema.ts` import from their sibling
  service/router files. Structural, not really a testable property, but worth noting
  it checked out.
- `type-level regression` bullet in plan.md §3 (destructured `{ id, ...rest }` still
  satisfying `TaskUpdateInput`/`EventUpdateInput`) is explicitly scoped by the plan
  itself to `npm run typecheck`, not vitest — confirmed passing, no test needed per
  the plan's own reasoning.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scope per AGENT_RULES.md's re-review section: only what changed since round 1 —
`git show 482863f` (fix commit on `feat/shared-zod-schemas`, PR #35), which touches
exactly `apps/server/src/routers/task-router.test.ts` and
`apps/server/src/routers/event-router.test.ts` (39 lines added, 3 new tests, no
source files touched). Did not re-derive round-1 findings or re-run
lint/typecheck/build (CI already green per orchestrator's `gh pr checks` gate).

### Verification

Independently re-ran the fixer's mutation claims (didn't just trust the commit
message) rather than fully redoing every experiment from scratch:

- **Gap 1 (malformed `dueDate` on task create, no test)**: reverted
  `taskCreateInput.dueDate` from `wireDateTimeString.optional()` to plain
  `z.string().optional()` and ran `task-router.test.ts` — exactly one test failed:
  the new `"rejects a malformed dueDate string"` in the `create` block (20/21 passed,
  all pre-existing tests unaffected). Reverted the mutation, `git status` clean.
  Confirms the new test is load-bearing, not a tautology.
- **Gap 2, direction A (event `date: null` should reject)**: reverted
  `eventUpdateFields.date` from `.optional()` to `.nullable().optional()` and ran
  `event-router.test.ts` — exactly one test failed: the new `"rejects date: null —
  unlike task's dueDate, an event's date is not nullable"` (15/16 passed). Reverted,
  clean.
- **Gap 2, direction B (task `dueDate: null` should resolve)**: reverted
  `taskUpdateFields.dueDate` from `.nullable().optional()` to `.optional()` and ran
  `task-router.test.ts` — the new `"accepts dueDate: null and clears the existing due
  date via TaskService.update"` failed with a `ZodError`/`BAD_REQUEST` (expected
  string, received null), all others passed. Reverted, clean.
- Full suite after reverting all three mutations: `npx vitest run` in
  `apps/server` → 5 files, **89/89 passing** (86 baseline + 3 new), matching the
  round-1 baseline plus exactly the tests added. `git status --short` shows only
  the untracked `tickets/shared-zod-schemas/` directory — no source drift left over
  from the mutation testing.
- Read `TaskService.update` (`apps/server/src/services/task-service.ts`) to confirm
  the new task `dueDate: null` test isn't asserting a mock call in name only: the
  test's `findUnique.mockResolvedValue({ id: "1", kind: "task", ... })` is required
  for `assertTaskExists` to pass before the real branching logic
  (`input.dueDate === null ? null : ...`) runs and reaches
  `expect(update).toHaveBeenCalledWith(... data: expect.objectContaining({ dueDate: null }) ...)`.
  This exercises the actual service code path end-to-end from the router's zod
  boundary through to the DB call args, not just a stubbed return value.

Both round-1 blocking findings are genuinely closed: the new tests fail when their
respective bug is reintroduced and pass on current `main`-of-branch code, and they
exercise real schema/service behavior (DB-call arguments, thrown errors) rather than
merely checking that a mock function was invoked.

### Non-blocking

- The three new tests are additive only — no existing test was modified, consistent
  with plan.md's "no behavior change" contract for the rest of the refactor (this fix
  commit is pure test-file addition, no source touched, as its own commit message
  states and the diff confirms).

VERDICT: APPROVED
