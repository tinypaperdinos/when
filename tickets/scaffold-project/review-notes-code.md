## reviewer-code — round 1

Reviewed `git diff main...feat/scaffold-project` against `ticket.md` and `plan.md`, and
ran the actual stack (`npm ci`, `npm run lint/typecheck/test/build`, `prisma migrate dev`,
seeding, starting both dev servers, hitting `tasks.list` through a direct `curl` and the
Vite proxy) rather than only reading the diff.

### Findings

1. **[blocking]** `apps/server/package.json`'s `dev` script —
   `"tsx --env-file=.env watch src/index.ts"` — crashes immediately with
   `ERR_MODULE_NOT_FOUND: Cannot find module '.../apps/server/watch'`. Reproduced with the
   exact pinned `tsx@4.23.1`. Root cause: tsx's CLI requires the `watch` subcommand to be
   the very first token; putting `--env-file=.env` before it makes tsx treat the literal
   string `watch` as the script path instead. Fix: reorder to
   `"tsx watch --env-file=.env src/index.ts"`. This breaks `npm run dev -w apps/server` and
   the root `npm run dev` (via `concurrently`) — exactly the command the ticket's "done"
   criteria and `README.md`'s new "Getting started" section depend on, and exactly the risk
   plan.md §7's last edge case told the implementer to manually verify before calling it
   done. After manually reordering to confirm, the whole chain genuinely works end-to-end
   (migrated + seeded rows come back through both the raw server and the web dev-server
   proxy) — so the underlying `db.ts` path-resolution fix from refiner round 1 is correct;
   this is purely a CLI-argument-ordering bug that appears to have shipped without the dev
   script actually being run.

2. **[non-blocking, judgment call]** Re-checked whether the missing `superjson` transformer
   (flagged non-blocking in `refiner-notes.md` round 2) is still fine to leave non-blocking
   given what's actually in this diff. Confirmed via manual `curl` that date fields do come
   back as plain strings while typed as `Date` — but nothing in the shipped code
   (`tasks-page.tsx`, its tests, `TaskService`, the router tests) ever reads or calls a
   `Date` method on those fields. Agree with the refiner: stays non-blocking for this round,
   re-flagged so it isn't lost before the next ticket that renders `dueDate`.

VERDICT: BLOCKING FINDINGS

## reviewer-code — round 2

Re-reviewed `git diff main...feat/scaffold-project` (now including fix commit `f6174a4`)
against `ticket.md` and `plan.md`. Focus: verify the round-1 blocking finding is genuinely
fixed (not just claimed), and check the two additional fixes the fixer applied beyond that
finding.

### Round-1 blocking finding — verified fixed

`apps/server/package.json`'s `dev` script is now `"tsx watch --env-file=.env src/index.ts"`.
Actually ran it, not just read the diff:

- Started `npm run dev -w apps/server` in the background against the existing migrated +
  seeded `apps/server/prisma/dev.db`. Log output: `server listening on http://localhost:3001`
  (previously this crashed immediately with `ERR_MODULE_NOT_FOUND`).
- `curl http://localhost:3001/trpc/tasks.list` returned the two real seeded rows (`"Buy
  milk"`, `"Write scaffold ticket notes"`) with correct `dueDate`/`kind`/`completed` fields —
  confirms both the tsx argument-order fix and the underlying `db.ts` absolute-path
  resolution are wired correctly end-to-end, not just individually correct.
- Also re-ran `npm run lint --workspaces`, `npm run typecheck --workspaces`, and
  `npm run test --workspaces` from a clean state: all pass (8 server tests, 4 web tests, 0
  lint errors, clean `tsc`/`tsc -b`).

Genuinely fixed. Not blocking.

### Fix 1 — `task-service.test.ts` orderBy assertion

`expect(db.entry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { kind:
"task" }, orderBy: { dueDate: "asc" } }))` now checks both clauses in one assertion, matching
`TaskService.list()`'s actual call (`where: { kind: "task" }, orderBy: { dueDate: "asc" }` in
`apps/server/src/services/task-service.ts`). Correctly addresses reviewer-tests round-1
finding #1 — reverting the sort would now fail this test. No new problems: doesn't change
what's mocked, doesn't weaken the existing `where` check, all three tests in the file still
pass.

### Fix 2 — `no-restricted-imports` eslint rule for the `server` import-type-only boundary

Added `@typescript-eslint/no-restricted-imports` (with `allowTypeImports: true` on the
`"server"` path) inside the existing `files: ["apps/web/src/**/*.{ts,tsx}"]` block in
`eslint.config.js`, alongside the `react-hooks` rules. Checked for problems:

- **Scope is correct**: it lives inside the block already scoped to `apps/web/src/**`, so it
  doesn't affect `apps/server`'s own lint run (which has no reason to import its own package
  by name anyway). Confirmed via `npx eslint --print-config apps/web/src/trpc.ts` that the
  rule is active there.
- **No base-rule conflict**: `no-restricted-imports` (the non-typescript-eslint base rule) is
  not enabled anywhere in the config (checked `--print-config` output: `no-restricted-imports`
  is `null`/absent), so there's no duplicate-reporting risk from having both the base and
  `@typescript-eslint/`-prefixed versions active, which is a common footgun with this rule
  pair.
- **Verified it actually rejects a value import**, not just trusting the fixer's commit
  message claim: dropped a throwaway `apps/web/src/__tmp-bad-import.tsx` with
  `import { appRouter } from "server";`, ran `npx eslint` on it directly — got a hard error
  (`'server' import is restricted...`, exit code 1). Deleted the scratch file afterward
  (confirmed via `git status --short` that the tree is clean, nothing left behind).
- **Verified it doesn't false-positive** on the legitimate existing usage: full
  `npm run lint --workspaces` (which lints `apps/web/src/trpc.ts`'s
  `import type { AppRouter } from "server"` and `tasks-page.test.tsx`'s equivalent) passes
  clean.

This is a reasonable, correctly-scoped addition that turns plan.md §4.5's "design invariant"
into an enforced lint rule instead of relying on the incidental Vite-build backstop
reviewer-tests round 1 noted — no new problems found.

### Scope check

Both additional fixes are within the two things reviewer-tests round 1 explicitly flagged as
non-blocking follow-ups (§4.6/§7 territory: sort-order test coverage, import-boundary
enforcement) — not unrequested scope creep. No other files touched by the fix commit.

VERDICT: APPROVED
