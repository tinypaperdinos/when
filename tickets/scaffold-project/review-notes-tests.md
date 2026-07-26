## reviewer-tests — round 1

Reviewed `git diff main...feat/scaffold-project` test files against `plan.md` §7
(edge cases) and `ticket.md`. Ran the actual suites (`npm run test --workspace=apps/server`,
`npm run test --workspace=apps/web`) — all 8 + 4 tests pass. Also independently verified,
outside the test suite, the items plan.md explicitly scopes as *manual* verification rather
than automated tests (fresh clone, `npm ci`, `prisma migrate deploy` against a brand-new
SQLite file, `prisma db seed`, then running the real Express/tRPC server via
`tsx --env-file=.env` and `curl`ing `tasks.list`) — the seeded rows came back correctly,
confirming `db.ts`'s `resolveDatasourceUrl` is wired correctly end-to-end, not just correct
in isolation.

### Findings

1. **[non-blocking]** `apps/server/src/services/task-service.test.ts` never asserts on the
   `orderBy: { dueDate: "asc" }` clause in `TaskService.list()` — only the `where` clause is
   checked via `expect.objectContaining({ where: { kind: "task" } })`. If the due-date sort
   were dropped or changed, no test would catch it. Not called out in plan.md §7's edge-case
   list, and low risk for this ticket's scope ("no UI polish", proof-of-wiring), so not
   blocking — but worth a one-line addition (`expect.objectContaining({ orderBy: { dueDate:
   "asc" } })`) in a follow-up.

2. **[non-blocking]** The `import type`-only boundary between `apps/web` and `server`
   (plan.md §4.5/§7 — "verify a value import genuinely fails or is at least never
   introduced; this is a design invariant, not just a style preference") has no dedicated
   lint rule (no `no-restricted-imports`/`import/no-internal-modules` in `eslint.config.js`)
   or regression test guarding it. Currently compliant — grepped the diff, both usages
   (`apps/web/src/trpc.ts`, `apps/web/src/routes/tasks-page.test.tsx`) are `import type {
   AppRouter } from "server"`. In practice a future accidental value import (e.g. `import {
   appRouter } from "server"`) would likely still be caught incidentally by `vite build`/`vite
   dev` failing to resolve server-only Node built-ins (`express`, `node:path`) for the browser
   target, so this isn't fully unguarded — but there's no fast, explicit unit-level check.
   Non-blocking since it's a forward-looking gap, not a bug in the current diff, and there's
   an incidental build-time backstop.

3. **[non-blocking, confirmed no gap]** Plan §7's remaining edge cases — `postinstall: "prisma
   generate"` running on a clean `npm ci`, migration applying cleanly to a fresh SQLite file,
   the runtime `PrismaClient` reading/writing the *same* file `prisma migrate dev` migrated,
   and `tsx --env-file=.env` actually loading `DATABASE_URL` — are all explicitly scoped by
   plan.md §6 as manual-verification items, not automated-test requirements (deliberately, to
   avoid a test-database lifecycle in CI). I independently re-verified all four from a fresh
   clone (see above) and they all pass. Flagging only so the verification is on record — no
   action needed.

### Test-quality checks (would these tests actually catch a reverted bug?)

- `db.test.ts`: the "resolves a relative file: URL" test computes its `expected` value using
  `path.resolve(baseDir, "../prisma", "./dev.db")` — the `"../prisma"` segment is a literal
  hardcoded in the test, independent of the implementation's own hardcoded `"../prisma"` in
  `db.ts`. If the implementation's base-directory segment changed (a real prisma/npm-workspaces
  regression this ticket exists to prevent), the test would fail. Not tautological.
- `task-service.test.ts` / `task-router.test.ts`: assert on mock call-args
  (`where: { kind: "task" }`) per plan.md's explicit instruction ("not just an integration
  test that happens to have no event rows to accidentally exclude") — confirmed these are
  real regression guards, not just "was the mock called" checks: reverting the `kind: "task"`
  filter in either `task-service.ts` or `task-router.ts` would fail the corresponding
  assertion.
- `tasks-page.test.tsx`: all four states (loading, populated, empty, error) render through a
  real `TRPCProvider` + `QueryClient` + `httpBatchLink` with a swapped-in `fetch`, and assert
  on rendered text via Testing Library — not stubbed component props. Confirmed by the actual
  test run (all 4 pass) that the wire-protocol fixture shape
  (`[{ result: { data: [...] } }]`) is correctly parsed by the real `httpBatchLink`, since the
  populated/empty tests assert on data-dependent text that could only render via successful
  parsing, not by coincidence of the error/loading fallback paths.

No genuinely risky edge case from plan.md §7 is left uncovered by either an automated test or
an independently-confirmed manual check.

VERDICT: APPROVED

## reviewer-tests — round 2

Scope: verify the fixer's changes since round 1 (commit `f6174a4`). Two changes touch
test-relevant surface:

1. `apps/server/src/services/task-service.test.ts` — added an `orderBy: { dueDate: "asc" }`
   assertion to the existing `where`-clause check, addressing round-1 non-blocking finding #1.
2. `eslint.config.js` — added `@typescript-eslint/no-restricted-imports` (scoped to
   `apps/web/src/**`, `allowTypeImports: true`, restricting the `server` package), addressing
   round-1 non-blocking finding #2. Not a test file, but re-checked per instruction since it
   changes CI-enforced behavior.

The third change in that commit (`apps/server/package.json`'s `dev` script reordering,
`tsx --env-file=.env watch` → `tsx watch --env-file=.env`) was reviewer-code's round-1
blocking finding, not reviewer-tests' — out of scope for this file, not re-litigated here,
but spot-checked (`grep '"dev"' apps/server/package.json`) to confirm the fix is present in
the diff I'm reviewing.

### Verification performed

- Ran both suites fresh: `npm run test --workspace=apps/server` (8/8 pass, 3 files) and
  `npm run test --workspace=apps/web` (4/4 pass, 1 file). Also `npm run typecheck` (root,
  fans out to both workspaces) — clean.
- **Mutation-tested the new `orderBy` assertion directly** (not just read it): temporarily
  edited `apps/server/src/services/task-service.ts` in the working tree to (a) drop the
  `orderBy` clause entirely, and (b) change `"asc"` to `"desc"`. Both mutations made
  `task-service.test.ts`'s "filters to kind: task, excluding events" test fail with a clear
  diff (`ObjectContaining{orderBy:{dueDate:"asc"}}` vs. the mutated call args). Reverted the
  file afterward (`git diff` on that file is now clean, confirmed via `git status --porcelain`
  showing no changes to the repo). This closes round-1 finding #1 for real — the test is a
  genuine regression guard, not one that would pass against a reverted/buggy implementation.
- **Verified the new ESLint rule actually enforces the boundary**, not just that it's
  configured plausibly: created a scratch file
  `apps/web/src/__tmp-verify-restricted-import.tsx` with `import { appRouter } from "server"`,
  ran `npx eslint` on it directly — got the expected
  `@typescript-eslint/no-restricted-imports` error with the custom message. Deleted the
  scratch file immediately after (confirmed via `git status --porcelain` the working tree is
  clean, matching `feat/scaffold-project` exactly — no stray files left behind). Also ran
  `npm run lint --workspace=apps/web` and the root `npm run lint` (fans out to both
  workspaces) against the actual diff's existing files — both pass clean, confirming the rule
  doesn't false-positive on the two legitimate `import type { AppRouter } from "server"`
  usages (`apps/web/src/trpc.ts`, `apps/web/src/routes/tasks-page.test.tsx`).
  - Note: during this session I observed a transient, already-untracked
    `apps/web/src/__tmp-bad-import.tsx` file appear briefly in `git status`/`eslint` output
    and then disappear before a subsequent `Read`/`git status` — looked like leftover state
    from the fixer's own manual verification of this same rule (mentioned in the commit
    message: "Verified it rejects a value import and allows the existing `import type`
    usages"), not something in the actual diff. Confirmed it isn't tracked, isn't in
    `git diff main...feat/scaffold-project`, and the tree is clean now — flagging only for
    the record, no action needed.

### Findings

Both round-1 non-blocking findings are now closed:

1. **[resolved]** `orderBy` is now asserted and mutation-tested to genuinely catch a dropped
   or changed sort (see above). No further action.
2. **[resolved]** The `import type`-only boundary now has a dedicated, verified ESLint rule
   in addition to the incidental build-time backstop noted in round 1. No further action.

No new gaps introduced. The `eslint.config.js` change is config, not a test file, but I
confirmed it doesn't regress lint on the existing diff and does enforce the invariant it
claims to — nothing further to check there per the task instructions. All of plan.md §7's
edge cases remain covered exactly as verified in round 1 (unchanged files); nothing in this
fix round touched `db.test.ts`, `task-router.test.ts`, or `tasks-page.test.tsx`, and I did not
find any new behavior change in the diff that lacks test coverage.

VERDICT: APPROVED
