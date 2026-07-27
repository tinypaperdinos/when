# Review notes (code): event-crud

## reviewer-code — round 1

### Method
- Corrected a stale local `main` ref before diffing (local `main` was pinned at `3110279`,
  missing already-merged PRs #31/#32; `git branch -f main origin/main` fixed this — the
  real diff for this ticket is exactly one commit, `323a618`, touching
  `apps/server/src/routers/{app-router.ts,event-router.ts,event-router.test.ts}` and
  `apps/server/src/services/{event-service.ts,event-service.test.ts}`, 580 insertions, 0
  deletions/modifications outside those 5 files).
- Read `tickets/event-crud/ticket.md` (pointer to issue #7), `plan.md`, `refiner-notes.md`,
  `.claude/AGENT_RULES.md`.
- Cross-read `apps/server/src/services/task-service.ts`, `apps/server/src/routers/
  task-router.ts`, `apps/server/src/trpc.ts`, `apps/server/prisma/schema.prisma` for
  pattern/schema-fidelity comparison.
- Ran the actual suite: `npm --workspace apps/server run test -- --run` → 86/86 passed.
  `npm --workspace apps/server run typecheck` and `run lint` → both clean. `gh pr checks 33`
  → CI `build` job green.
- Ran a throwaway script (`apps/server/src/__scratch_check_proxy*.ts`, deleted after use,
  not part of the diff) against the actual built router to verify the `toggleComplete`
  reasoning below empirically rather than by inspection alone.

### Scope fidelity vs. issue #7
Matches the plan and the issue text exactly: `EventService`/`eventsRouter` with
`list`/`create`/`update`/`delete` only, mounted as `events` on `appRouter`, zero
`apps/web` changes, zero schema/migration changes, no tags, no recurrence, no reminder
field. Nothing beyond the 5 files the plan named was touched. No scope creep, no missed
requirement.

### Correctness
- `EventService`/`event-router.ts` are essentially verbatim the plan's §3.2/§3.3 code
  sketch — no daylight between planned and shipped code.
- `Entry.date`/`Entry.notes`/`Kind` schema fields (`apps/server/prisma/schema.prisma`)
  confirmed to already exist exactly as the plan assumed; no schema/migration change
  needed or made.
- No `superjson` transformer in `apps/server/src/trpc.ts` (confirmed) — consistent with
  `AGENT_RULES.md`'s documented gap; this ticket's own code never calls a `Date` method on
  a wire-crossed value (only ever constructs `new Date(inputString)` before handing to
  Prisma), so it isn't affected.
- `notes`/`date` tri-state handling in `create`/`update` mirrors `TaskService` exactly,
  verified line-by-line.
- Cross-kind protection (`assertEventExists` rejecting a `kind: "task"` row with
  `NOT_FOUND` on `update`/`delete`) present and tested, matching `TaskService`'s existing
  precedent.

### Verification of the flagged `toggleComplete` test-design deviation
The plan's §4 suggested `expect((eventsRouter as any).toggleComplete).toBeUndefined()`.
Empirically checked both forms:
- `(eventsRouter as any).toggleComplete` (the plain router object, as the plan's own code
  snippet actually names it) evaluates to `undefined` directly — this form would in fact
  have worked fine.
- `(caller.events as any).toggleComplete`, where `caller = appRouter.createCaller({})` —
  evaluates to `[Function: noop]`, and so does `(caller.events as any).anyMadeUpName`
  for a property that was never a real procedure. Confirmed: tRPC's `createCaller` proxy
  returns a callable stand-in for *any* property access on the caller, real or not, so a
  `.toBeUndefined()` assertion against a caller-derived property can never distinguish
  "procedure exists" from "procedure doesn't exist" — it would fail identically either
  way. (Invoking that callable, e.g. `await caller.events.toggleComplete(...)`, does
  correctly throw `TRPCError NOT_FOUND: No procedure found on path "events,toggleComplete"`
  — so the proxy's laziness only bites at the point of plain property *access*, not
  invocation.)
- The shipped test, `expect("toggleComplete" in eventsRouter).toBe(false)`, operates on
  the plain router object (not a caller), and `in` correctly reflects real key presence:
  confirmed `Object.keys(eventsRouter)` is exactly `['list', 'create', 'update', 'delete',
  '_def', 'createCaller']` — no `toggleComplete`. This assertion would flip to `true`
  (correctly failing) if a `toggleComplete` procedure were ever added to the router
  definition.
- Conclusion: the implementer's stated reasoning for deviating from the plan's literal
  snippet is correct in substance (a caller-derived property check is unusable for this
  purpose), even though the plan's snippet, read literally, named `eventsRouter` rather
  than a caller and so wasn't actually broken as literally written. The shipped test does
  genuinely prove what it claims — no non-blocking or blocking issue here.

### Test coverage vs. plan §4
Every edge case enumerated in the plan's §4 (list ordering/empty-result, create's
kind-hardcoding/date-conversion for both date-only and date+time forms/notes tri-state,
update's NOT_FOUND-on-unknown-id and NOT_FOUND-on-wrong-kind and untouched-field rigor
(`date: undefined, notes: undefined` asserted in the literal call object, not just absent
from a partial matcher) and date-replacement and notes-clear/set, delete's NOT_FOUND cases
and success shape, router-level Zod-rejection tests for every procedure) is present, with
no gaps. Router-level tests don't independently re-prove `TRPCError`→rejection propagation
through `createCaller` (only Zod-rejections are exercised at the router layer; NOT_FOUND
propagation is only tested at the service layer) — this exactly mirrors
`task-router.test.ts`'s existing precedent (confirmed by grep), so it's not a new gap this
ticket introduces.

### Design
Structurally identical to `TaskService`/`tasksRouter` (constructor-injected
`PrismaClient`, same `assertXExists` pattern, same thin-procedure-delegates-to-service
shape, same fake-db and `createCaller` test harnesses). No shared base class introduced,
consistent with the plan's §6.1 reasoning and `AGENT_RULES.md`'s "don't introduce a
shared layer speculatively" guidance. `eventDateString`'s regex is duplicated from
`task-router.ts` rather than extracted — flagged by the plan itself as a minor, low-stakes
duplication (§6.4); I agree it's not worth fixing here.

### Simplification
Nothing to simplify — this is about as thin as a CRUD router/service pair can be, and
matches the existing sibling's shape exactly rather than inventing a new one.

### Nothing else flagged
No logic errors, no missed edge cases beyond what's already accepted as pre-existing gaps
(TOCTOU, calendar-invalid date strings, timezone parsing) that both the plan and the
prior Task CRUD ticket already carry forward deliberately. CI is green; local
lint/typecheck/test all pass.

VERDICT: APPROVED
