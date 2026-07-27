## reviewer-code — round 1

Reviewed commit `a287c37` (PR #35, `feat/shared-zod-schemas` vs `main`) against `ticket.md`
(GitHub issue #34) and `plan.md`. Ran `npm run typecheck`, `npm run lint`, and `npm test`
(server + web workspaces) locally — all green (server: 5 files / 86 tests passed; web: 17
files / 161 tests passed). CI's `build` job was still `pending` at review time
(https://github.com/tinypaperdinos/when/actions/runs/30291161848/job/90061009766); per
AGENT_RULES.md round-1 review doesn't require waiting on that, but worth the orchestrator
confirming it goes green before marking the PR ready.

### Scope fidelity vs. ticket.md / plan.md

- Matches the plan closely, effectively line-for-line:
  - `schema-helpers.ts` (new) — `wireDateTimeString` regex + `idInput`, both byte-identical
    to what was pasted twice before.
  - `task-schema.ts` / `event-schema.ts` (new) — one schema per input shape, colocated with
    each service, exported as both the runtime validator and `z.infer<...>` type.
  - `task-service.ts` / `event-service.ts` — `create`/`update` signatures now use the
    `z.infer`-derived types; `toggleComplete`/`delete` scalar params (`id: string`,
    `completed: boolean`) deliberately left as primitives, matching plan §4.
  - `task-router.ts` / `event-router.ts` — local `z.object({...})` definitions deleted;
    routers now import and compose the shared schemas (`idInput.merge(taskUpdateFields)`,
    etc.) instead of redeclaring the shape.
  - Applied to **both** task and event pairs, not just task — matches the plan's explicit
    (flagged) scope decision to extend the pattern to `event-crud`'s pair even though the
    issue's literal text only names task as the reference implementation.
  - `title`/`notes` field-level validators intentionally *not* shared cross-entity, exactly
    as plan §4 calls out.
  - No `apps/web` changes — confirmed via `git show a287c37 --stat`. Matches the plan's
    non-goal.
  - No new `*-schema.test.ts` files — matches plan §4; existing router/service test files
    are unmodified by this commit (confirmed via `git show a287c37 --stat`: only
    `event-router.ts`, `task-router.ts`, `event-schema.ts`, `event-service.ts`,
    `schema-helpers.ts`, `task-schema.ts`, `task-service.ts` touched) and all still pass.
  - No `schema.prisma` changes. Matches plan §2.3.

### Correctness

- Business logic (the `notes ? notes : undefined` / `input.notes || null` collapsing,
  `dueDate`/`date` string→`Date` conversion, the three-way `dueDate === undefined / null /
  string` branch on task update) is still in the service method bodies, not folded into a
  zod `.transform()`. This was flagged in plan §3 as the main risk in this refactor and it
  was avoided — `task-service.ts:33-48` and `event-service.ts:33-43` are otherwise untouched
  logic, only the parameter type changed.
- The task/event asymmetry on `date`/`dueDate` nullability survived: `taskUpdateFields.dueDate`
  is `.nullable().optional()`, `eventUpdateFields.date` is `.optional()` only (no
  `.nullable()`) — matches current `main` behavior and plan §2.1's explicit "preserved
  deliberately" note.
- `idInput.merge(taskUpdateFields)` / `idInput.merge(eventUpdateFields)` /
  `idInput.merge(taskToggleCompleteFields)` produce the same runtime shape as the old
  hand-written `updateInput`/`toggleCompleteInput` objects (verified by reading the merged
  field lists and by the full test suite passing unmodified).
- Router `update` handlers still destructure `{ id, ...rest }` and pass `rest` to
  `TaskService.update`/`EventService.update`; `rest`'s inferred type structurally matches
  `TaskUpdateInput`/`EventUpdateInput` — confirmed by `npm run typecheck` passing (this was
  called out in plan §3 as a compile-time-only risk that wouldn't show up in `vitest`).
- No import cycle: `schema-helpers.ts` has no back-reference into `task-schema.ts`/
  `event-schema.ts`; both schema files only import from `schema-helpers.ts` and `zod`.

### Design

- Fits the existing service/router split described in AGENT_RULES.md (thin router,
  validation via Zod, business logic in the service class) — if anything this commit makes
  that split more explicit by removing the router-level schema duplication.
- `idInput`/`wireDateTimeString` extraction is justified per plan §4's reasoning (structural/
  generic pieces, not per-entity business rules) rather than over-abstracted.

### Minor / non-blocking observations

- `zod` v4.4.3 (checked `node_modules/zod/package.json`) still supports `.merge()`, and it's
  used consistently with idiomatic zod-object composition; no deprecation warning surfaced
  in `lint`/`typecheck`/`build`. Not a finding, just confirming it's not a latent issue.
- No other issues found.

### Verification commands run

- `npm run typecheck` — pass (server + web)
- `npm run lint` — pass (server + web)
- `npm test` — pass (server: 86/86, web: 161/161)
- `git show a287c37 --stat` / `git show a287c37` — confirmed diff scope matches plan exactly
- `gh pr checks 35` — `build` pending at review time (not yet resolved either way)

VERDICT: APPROVED

## reviewer-code — round 2

Scope per AGENT_RULES.md's "Re-review scope (round 2+)": diffed fix commit `482863f`
(PR #35) against the round-1-approved `a287c37`, not a full re-audit.

- `git diff a287c37..482863f --stat` / `git show 482863f`: touches exactly two files,
  `apps/server/src/routers/task-router.test.ts` (+29) and
  `apps/server/src/routers/event-router.test.ts` (+10) — no source files. Confirms the
  fixer's commit message claim ("No source changes") is accurate; `task-schema.ts`,
  `event-schema.ts`, `schema-helpers.ts`, both routers, and both services are untouched
  since round 1.
- `git log --oneline main..feat/shared-zod-schemas` shows only `a287c37` and `482863f`
  on top of the branch point — nothing else landed on the branch between rounds.
- The three added tests (malformed `dueDate` on task create; `dueDate: null` accepted on
  task update; `date: null` rejected on event update) follow the existing file
  conventions exactly (dynamic `import("./app-router")`, `appRouter.createCaller({})`,
  `.rejects.toThrow()` / `.resolves.toBe(row)`, asserting the service mock was/wasn't
  called) — no new test infrastructure or pattern introduced.
- No `apps/web` or `schema.prisma` changes; stays within plan.md's stated non-goals.
- This is exactly the right shape of fix for a "runtime already correct, just untested"
  finding: closes the coverage gap without touching working code. Per AGENT_RULES.md's
  round-2 guidance not to duplicate verification reviewer-tests already did (mutation
  testing was reported in the fix commit message), I did not independently re-run the
  mutation checks — confirming the diff is test-only was the code-review-relevant
  question here.
- No blocking or non-blocking findings.

VERDICT: APPROVED
