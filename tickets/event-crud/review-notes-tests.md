# Review notes (tests): event-crud

## reviewer-tests — round 1

### Method
- Compared the actual diff (isolated to commit `323a618`, the only commit unique to
  `feat/event-crud` — `apps/server/src/{routers,services}/event-*.ts`/`.test.ts` and a
  2-line `app-router.ts` change; `git diff main...feat/event-crud` pulls in unrelated
  already-landed Task CRUD/Notes-on-tasks noise because local `main` is behind those
  merged PRs, so I diffed/read `git show 323a618` directly instead) against `plan.md` §4's
  edge-case list and `ticket.md`/issue #7.
- Ran `event-service.test.ts` and `event-router.test.ts` directly (`npx vitest run`,
  35/35 passing) and the full server suite (86/86 passing).
- Mutation-tested the two riskiest assertions rather than trusting them by inspection:
  1. Temporarily changed `EventService.update`'s title-only-update data shape to pass
     `date: null` instead of `date: undefined` — the "leaves date and notes untouched"
     test failed as expected, confirming it's a real regression guard, not a
     tautology. (Verified via a standalone probe in `vitest`, not by editing the actual
     source — no source files were left modified.)
  2. Temporarily added a `toggleComplete` procedure back onto `eventsRouter` (via a
     throwaway local edit, reverted immediately after, `git diff` clean afterward) and
     re-ran `event-router.test.ts` — the "has no toggleComplete procedure" test failed
     as expected (`expected true to be false`), confirming it genuinely detects the
     regression it claims to guard against.
  3. Separately probed the plan's originally-suggested form,
     `expect((caller as any).toggleComplete).toBeUndefined()` on a `createCaller`
     instance — confirmed empirically that `caller.toggleComplete` is a callable proxy
     function (`[Function: tRPC.proxy(toggleComplete.name)]`) regardless of whether the
     procedure exists, so that literal form would fail even against a correct
     implementation with no `toggleComplete`. The implementer's stated reasoning for
     deviating from the plan's snippet is correct, and the shipped
     `"toggleComplete" in eventsRouter` (checked on the plain router object, not a
     caller) genuinely proves the absence claim and would catch a reintroduction.

### Coverage vs. plan.md §4 — verified item by item
All of the following are present and, where checked via mutation, genuinely fail if the
underlying behavior regresses:
- `list`: `where: { kind: "event" }` / `orderBy: { date: "asc" }` args asserted; returns
  db result unmodified (`toBe`, not `toEqual`, so a defensive copy/transform would be
  caught); explicit `[]`-when-empty case.
- `create`: kind hardcoded regardless of input; both date-only and date+time strings
  converted via `new Date(...)` before the `db.entry.create` call (verified as exact
  object equality, not `objectContaining`, for the date-only/date+time cases); notes
  tri-state (omitted → `undefined`, provided → passthrough, whitespace-only → normalized
  to `undefined`) all covered.
- `update`: NOT_FOUND for unknown id; NOT_FOUND for id-exists-but-`kind: "task"` (and
  `db.entry.update` asserted not called in the wrong-kind case); title-only update
  asserts `date: undefined, notes: undefined` as literal object keys in the actual call,
  not merely absent from a partial matcher — confirmed by mutation test above that this
  actually catches a `null`-instead-of-`undefined` regression; date replacement; notes
  `null` clears; notes non-empty string sets.
- `delete`: NOT_FOUND for unknown id and for wrong-kind id (with `db.entry.delete`
  asserted not called in the wrong-kind case); success shape (`{ where: { id } }` call,
  `{ id }` resolution).
- Router: one `createCaller` happy-path test per procedure, each proving the Zod schema
  passes through to the right `EventService` method; `create` rejects empty title,
  whitespace-only title, missing date, malformed date; `update` rejects malformed date,
  whitespace-only title, and correctly *accepts* `notes: null` as a clear; `delete`
  rejects empty id; explicit, verified-correct "no `toggleComplete`" assertion (see
  Method above).
- Router-level tests don't independently re-prove `TRPCError`→rejection propagation
  through `createCaller` (NOT_FOUND propagation is only exercised at the service layer,
  not via `caller.events.update`/`delete` with a mocked unknown id) — this exactly
  mirrors `task-router.test.ts`'s existing precedent for the sibling ticket (confirmed by
  grep — no such test exists there either), so this isn't a gap introduced by this
  ticket specifically. Non-blocking.

### Non-blocking: notes empty-string-on-update parity gap vs. the sibling test suite
`plan.md` §4's literal edge-case list for `update` only calls for `notes: null` clearing
and non-empty `notes` setting, and this ticket's tests satisfy that literal list. But
`EventService.update`'s notes logic (`input.notes === undefined ? undefined :
input.notes || null`) is byte-for-byte the same tri-state logic `TaskService.update`
uses, and the sibling `task-service.test.ts`/`task-router.test.ts` (this ticket's own
stated pattern to mirror, per plan §2/§3.2) explicitly test the empty-string-after-trim
case that this ticket's tests don't:
- `task-service.test.ts` has `"clears existing notes when notes is an empty string
  (post-trim)"` (`service.update("1", { notes: "" })` → expects `notes: null`);
  `event-service.test.ts` has no equivalent — only the `notes: null` case is tested for
  update, not `notes: ""`.
- `task-router.test.ts` has `"does not reject an empty-string or whitespace-only notes
  value on update, unlike title"`; `event-router.test.ts` has no equivalent for either
  `create` or `update` (it does test that whitespace/empty *titles* are rejected, but
  never asserts that whitespace/empty *notes* are accepted rather than rejected).
Risk is low in practice (identical, already-battle-tested logic copied verbatim, and the
router schema has no `.min(1)` on `notes` that could accidentally reject it), but it's a
real, currently-unguarded edge: e.g. a future edit that swapped `input.notes || null` for
`input.notes ?? null` (silently changing "" from clear-to-null to keep-as-empty-string)
would pass every test in this diff undetected, while the identical bug in `TaskService`
would be caught immediately. Recommend adding the two missing tests (service: empty
string on update clears notes; router: empty/whitespace notes not rejected on
create/update) for parity, but not blocking this PR.

### Nothing else found
- No test asserts only that a mock "was called" without checking meaningful arguments or
  return values — every test in both files checks specific call arguments and/or
  resolved values.
- Scope-appropriate: no tests for `apps/web`, calendar-validity of `date` strings, or
  TOCTOU races — matches plan.md §4's explicit "not planned as a dedicated test" list.
- CI (`build` job on PR #33) is green; full local server suite (86/86) passes.

VERDICT: APPROVED
