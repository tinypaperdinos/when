# Refiner notes: event-crud

## Round 1

**Verdict: APPROVED**

### Method
Read `tickets/event-crud/ticket.md`, `gh issue view 7` (full text), `.claude/AGENT_RULES.md`,
and `tickets/event-crud/plan.md` in full. Cross-checked the plan's factual claims against
the real codebase: `apps/server/prisma/schema.prisma`, `apps/server/src/services/task-service.ts`
(+ its test file), `apps/server/src/routers/task-router.ts`, `apps/server/src/routers/app-router.ts`,
and the prior `notes-on-tasks` plan (to verify the "notes is a shared, kind-agnostic column"
claim). Every factual claim the plan makes about existing code checked out exactly — schema
fields, existing service/router shapes, the fake-db test pattern, and `notes-on-tasks/plan.md`
§"Notes on events" explicitly deferring event-notes wiring to "whenever `eventsRouter` exists,"
which this ticket now does.

### Scope fidelity vs. issue #7
Issue #7 asks for tRPC procedures for `kind: "event"`: date/time, no completion state, no
due-date semantics, explicitly separate from Task CRUD because of the missing toggle. The
plan delivers exactly this — `EventService`/`eventsRouter` with `list`/`create`/`update`/`delete`,
no `toggleComplete`, no `completed` field anywhere in the new code, and a dedicated test
asserting the toggle procedure doesn't exist. No schema/migration change, no `apps/web` change,
no tags, no recurrence, no reminder-offset feature — all correctly identified as out of scope
because the issue text doesn't ask for them and (for `apps/web` specifically) no existing
component consumes an event shape yet. This is a faithful, non-inflated read of a genuinely
terse issue; nothing here reads as invented scope.

### The flagged judgment call (`date` required on `create`)
This is a real ambiguity and the plan is right to call it out rather than bury it. The
reasoning for choosing "required" is sound (an event's `date` is its one defining trait per
both the issue text and the README framing; a null-dated event can't be placed on a calendar).
It's also cleanly reversible — the plan says so explicitly and correctly (one-line Zod
loosening, no other structural dependency). I'd have accepted either default here; what
matters is that it's surfaced, justified, and not load-bearing elsewhere in the plan, which it
is.

One related consequence worth naming for whoever picks up the future calendar-consuming
ticket, not blocking for this one: the "required" invariant is enforced only at the Zod/router
layer, not in the underlying Prisma type. `Entry.date` is still `Date | null` in the generated
Prisma type (necessarily, since it's a shared nullable column), so a future `apps/web` consumer
of `events.list()` will see `date: Date | null` in the inferred `AppRouter` type despite this
router never producing a null-dated event through normal use. That consumer will need its own
narrowing/assertion; this ticket doesn't need to do anything about it now, but it's a gap the
next ticket should be aware of rather than assume away.

### Edge cases / test coverage
The edge-case list in §4 is thorough and mirrors the already-reviewed Task CRUD list almost
exactly, adjusted correctly for the one semantic difference (no toggle) and the one field
difference (`date` required on create, non-nullable on update). Cross-kind protection
(`update`/`delete` on a task id via `eventsRouter` → `NOT_FOUND`) is called out and tested,
correctly reusing the same pattern `TaskService` already established elsewhere. TOCTOU and
calendar-invalid-date gaps are correctly identified as pre-existing, accepted risks carried
over from Task CRUD rather than something this ticket introduces or is expected to fix.

### Codebase fit
Structurally identical to `TaskService`/`tasksRouter`: same constructor-injected `PrismaClient`,
same `assertXExists` pattern, same thin-procedure/Zod-then-delegate shape, same fake-db test
harness, same `createCaller` router-test pattern. No new abstraction (e.g. a shared base class)
is introduced, and the plan gives a concrete, sensible reason for that restraint (the two
services' `create`/`update` field sets already differ and are likely to diverge further). This
matches `AGENT_RULES.md`'s explicit instruction not to introduce a shared layer speculatively.

### Nothing else flagged
No missing error states, no under- or over-scoping found beyond what's already noted above, no
mismatch between the plan and how this codebase already does the equivalent thing for tasks.

VERDICT: APPROVED
