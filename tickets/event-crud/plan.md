# Plan: Events (issue #7)

Issue #7's full text (fetched via `gh issue view 7`):

> Add tRPC procedures for the kind: "event" side of the Entry model — date/time, no
> completion state, no due-date semantics, just a reminder. Kept separate from Task CRUD
> (#4) since the semantics differ (no complete/incomplete toggle for events).
>
> Depends on: scaffold-project (merged, PR #3).

Task CRUD (issue #4, merged as PR #31/#32, further extended by Notes on tasks, issue #5,
PR #32) is the closest sibling of this ticket and the pattern this plan follows for
service-class structure, Zod schemas, router wiring, and test conventions.

## 1. What "done" means

- A new `EventService` class (`apps/server/src/services/event-service.ts`), structurally
  parallel to `TaskService`, operating exclusively on `Entry` rows where
  `kind: "event"`, with methods: `list`, `create`, `update`, `delete`.
- **No `toggleComplete`-equivalent method or procedure** — this is the ticket's one
  explicit semantic difference from Task CRUD ("no complete/incomplete toggle for
  events"), not an oversight. Events don't have a completion state at all (the shared
  `Entry.completed` column is task-only per `AGENT_RULES.md`'s data-model note); nothing
  in `EventService` ever reads or writes it.
- A new `eventsRouter` (`apps/server/src/routers/event-router.ts`), structurally parallel
  to `tasksRouter`: thin tRPC procedures (Zod input validation only) delegating to
  `EventService` methods, per `AGENT_RULES.md`'s "tRPC procedures are thin" rule. Mounted
  on `appRouter` as `events` (`apps/server/src/routers/app-router.ts`), alongside the
  existing `tasks` key.
- **No Prisma schema/migration change.** `Entry.date DateTime? // event only: date/time`
  and `Entry.notes String?` already exist (from scaffolding, PR #3) and are exactly the
  fields this ticket needs. This is pure service/router work, like Task CRUD was.
- **Backend only — no `apps/web` changes.** Unlike Task CRUD (issue #4), which explicitly
  asked for "minimal forms in apps/web," issue #7's text only asks for tRPC procedures;
  there is no event-facing UI, route, or form anywhere in `apps/web` today (confirmed by
  grep — the only "event" hits in `apps/web/src` are unrelated, e.g. React's `onChange`/
  `ChangeEvent`), and no existing component references an event API shape. This ticket
  doesn't add one. A future ticket (event forms / calendar view, per the README's MVP
  scope) is the consumer of these procedures.
- CI (`lint`, `typecheck`, `test`, `build`) stays green.

## 2. Context: what exists today

- `Entry` (`apps/server/prisma/schema.prisma`): `id, kind (task|event), title, notes?,
  dueDate? (task only), completed (default false, task only), date? (event only),
  createdAt, updatedAt, tags[]`. Both the `dueDate` and `date` columns are nullable at
  the schema level regardless of `kind` — SQLite/Prisma has no way to make a column
  conditionally required based on a sibling column's value — so any "event dates are
  required" rule (see §3.1) is enforced at the Zod/service layer, not the schema.
- `TaskService`/`tasksRouter` currently implement `list`, `create`, `update`,
  `toggleComplete`, `delete` for `kind: "task"`. This ticket is the same shape, minus
  `toggleComplete`, for `kind: "event"`. No shared base class is introduced — see §6.1 for
  why duplication over abstraction is the deliberate call here, same as `AGENT_RULES.md`'s
  precedent of not introducing new shared layers speculatively.
- `appRouter` (`apps/server/src/routers/app-router.ts`) currently mounts only `tasks:
  tasksRouter`. This ticket adds `events: eventsRouter` alongside it.
- No `EventService`, `eventsRouter`, or `events` key exists anywhere yet (confirmed via
  grep for `eventsRouter`/`EventService`/`kind: "event"` across `apps/server` — the only
  `kind: "event"` hits today are `TaskService`'s existing "wrong kind" `NOT_FOUND` tests).
- **Known gotcha this plan must respect** (`AGENT_RULES.md`, "`Date` fields cross the
  tRPC boundary as plain strings"): no `superjson` transformer is configured, so
  `AppRouter`'s inferred type for `date`/`createdAt`/`updatedAt` says `Date`, but the
  runtime value is a string. Not a concern for this ticket's own code (the server only
  ever converts wire strings *into* `Date` objects before handing them to Prisma; nothing
  in `EventService`/`eventsRouter` calls a `Date` method on a value that crossed the wire
  in the other direction), but flagged for whichever future ticket adds an
  `apps/web` consumer of `events.list`.
- `README.md`'s MVP scope line resolves what "just a reminder" means: *"Events: entries
  with a date/time but no due-date semantics — just a reminder, not something to
  complete."* This is describing an event's conceptual role (something to be reminded of
  at a fixed point in time, not a completable to-do), not naming a distinct "reminder"
  field or a reminder-offset/notification feature. Confirmed via repo-wide grep: no
  "reminder" field, model, or notification concept exists anywhere in the codebase. This
  ticket does not add one — see §5.

## 3. Task breakdown

### 3.1 Wire contract for `date` — and the one real judgment call in this plan

Mirrors Task CRUD's `dueDate` wire contract (`tickets/task-crud/plan.md` §3.1) almost
exactly, with one deliberate difference: **on `create`, `date` is required, not
optional.**

Reasoning: a task without a due date is a normal, common case (a general to-do with no
deadline) — that's why `TaskService.create`'s `dueDate` is optional. An event, by
contrast, *is* its date/time; the issue's own description leads with "date/time" as the
defining trait, and README.md's "just a reminder" framing only makes sense if the thing
being reminded-of has a when. An event row with `date: null` would be silently
unplaceable on the future calendar view and wouldn't satisfy the "reminder" framing at
all.

**Flagged as the most contestable call in this plan (see §6.2), not silently assumed**:
the issue text doesn't say "required" in so many words, and the schema itself leaves
`date` nullable (necessarily, per §2). If this reading is wrong and events are meant to
support a "someday, no fixed time" state analogous to a task with no due date, that's a
one-line loosening (`date: eventDateString.optional()` on `create`, dropping the
required-ness) with no other structural change needed elsewhere in this plan.

Given required-on-create, **`date` on `update` is optional but not nullable** — a
present `date` string replaces the existing one; there is no way to clear an event's date
back to "unset" through this router, since an event without a date isn't a meaningful
state under §3.1's reading (unlike a task's `dueDate`, which supports exactly that via
`null`). If input omits `date` entirely, it's left untouched (same "undefined = don't
touch" Prisma semantics `TaskService.update` already relies on).

Concretely, one of:
- a string matching `^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$` (mirrors `dueDateString` in
  `task-router.ts` exactly — the native `<input type="date">`/`<input type="time">`
  join format a future web form would produce), required on `create`, optional (but never
  `null`) on `update`.

Server validates with the same regex-based Zod string schema `task-router.ts` already
uses, converts via `new Date(theString)` before handing to Prisma. The same two caveats
Task CRUD's plan already documented carry over unchanged, so they're referenced rather
than re-derived: (a) date-only vs. date+time strings parse via different UTC/local rules
in JS's own `Date` constructor — a pre-existing, undocumented-by-this-ticket app-wide
gap, not something introduced or fixed here; (b) the regex checks format, not calendar
validity — a regex-valid-but-calendar-invalid string (e.g. `"2026-02-30"`) is silently
normalized by `Date`, not rejected, and persists as a different, wrong date; only
reachable via a direct/malicious API call since there's no UI yet to produce a date
through this ticket at all.

### 3.2 `apps/server/src/services/event-service.ts` (new)

```ts
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export class EventService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.entry.findMany({
      where: { kind: "event" },
      orderBy: { date: "asc" },
    });
  }

  private async assertEventExists(id: string) {
    const existing = await this.db.entry.findUnique({ where: { id } });
    if (!existing || existing.kind !== "event") {
      throw new TRPCError({ code: "NOT_FOUND", message: `Event ${id} not found` });
    }
  }

  async create(input: { title: string; date: string; notes?: string }) {
    return this.db.entry.create({
      data: {
        kind: "event",
        title: input.title,
        date: new Date(input.date),
        notes: input.notes ? input.notes : undefined,
      },
    });
  }

  async update(
    id: string,
    input: { title?: string; date?: string; notes?: string | null },
  ) {
    await this.assertEventExists(id);
    return this.db.entry.update({
      where: { id },
      data: {
        title: input.title,
        date: input.date === undefined ? undefined : new Date(input.date),
        notes: input.notes === undefined ? undefined : input.notes || null,
      },
    });
  }

  async delete(id: string) {
    await this.assertEventExists(id);
    await this.db.entry.delete({ where: { id } });
    return { id };
  }
}
```

Design notes (same reasoning `TaskService` already established, carried over rather than
re-argued):
- `create()` hardcodes `kind: "event"` — no `kind`/`completed` field on the input schema
  at all, so there's no way through this router to spoof a task-kind row or touch
  `completed`.
- Existence/kind check via a separate `findUnique` before `update`/`delete`, same
  TOCTOU tradeoff `TaskService` already accepts (`tickets/task-crud/plan.md` §3.3/§6.2) —
  not re-litigated here, same single-user-dev-SQLite-scale reasoning applies unchanged.
- `TRPCError` thrown directly from the service class, matching `TaskService`'s existing
  precedent (`tickets/task-crud/plan.md` §3.3/§6.3) — same single-transport (tRPC-only)
  reasoning.
- `notes` handling (tri-state: omitted → untouched on update / `undefined` on create,
  `null` or empty-after-trim → cleared, non-empty string → set) mirrors
  `TaskService`'s `notes` handling exactly, added by the Notes on tasks ticket (issue #5).
  Since `notes` is a shared, kind-agnostic column, there's no reason for events to behave
  differently here.
- `delete()` returns `{ id }`, not the deleted row — same asymmetry vs. `create`/`update`
  as `TaskService.delete`, same reasoning (client only needs confirmation of which id was
  removed).
- No `completed` anywhere in this file — not defaulted, not read, not written. This is
  the concrete expression of "no completion state for events."

### 3.3 `apps/server/src/routers/event-router.ts` (new)

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { EventService } from "../services/event-service";

const eventDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid date");

const createInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  date: eventDateString,
  notes: z.string().trim().optional(),
});

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").optional(),
  date: eventDateString.optional(),
  notes: z.string().trim().nullable().optional(),
});

const idInput = z.object({ id: z.string().min(1) });

export const eventsRouter = router({
  list: publicProcedure.query(() => new EventService(db).list()),

  create: publicProcedure
    .input(createInput)
    .mutation(({ input }) => new EventService(db).create(input)),

  update: publicProcedure.input(updateInput).mutation(({ input }) => {
    const { id, ...rest } = input;
    return new EventService(db).update(id, rest);
  }),

  delete: publicProcedure
    .input(idInput)
    .mutation(({ input }) => new EventService(db).delete(input.id)),
});
```

Notes:
- `eventDateString` is defined locally in this file, duplicating `task-router.ts`'s
  identical regex rather than extracting a shared helper — matches the existing
  precedent of each router file being self-contained (`task-router.ts` doesn't import
  anything shared for its own `dueDateString` either), and keeps "kept separate from Task
  CRUD" true at the file level, not just the router-mounting level. Flagged as a minor,
  low-stakes duplication in §6.3.
- `date` is **not** `.nullable()` anywhere (create: required; update: optional-but-not-
  null) — the concrete implementation of §3.1's judgment call.
- No `.output()` schema on any procedure — matches `tasksRouter`'s existing precedent of
  relying on Prisma's inferred return type through tRPC.
- No `toggleComplete`-equivalent procedure and no `completed` field on any input schema —
  the explicit semantic difference from `tasksRouter` this whole ticket exists to encode.

### 3.4 `apps/server/src/routers/app-router.ts` (modified)

```ts
import { router } from "../trpc";
import { tasksRouter } from "./task-router";
import { eventsRouter } from "./event-router";

export const appRouter = router({
  tasks: tasksRouter,
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;
```

One new import, one new key. No other change to this file.

### 3.5 `apps/server/src/services/event-service.test.ts` (new)

Fake-db pattern identical to `task-service.test.ts` (`vi.fn().mockResolvedValue(...)` per
Prisma method), `describe` blocks for `list`, `create`, `update`, `delete` — see §4 for
the exact edge-case list each block must cover.

### 3.6 `apps/server/src/routers/event-router.test.ts` (new)

`createCaller` + mocked `../db` module pattern identical to `task-router.test.ts`, one
happy-path test and one-or-more validation-rejection tests per procedure, proving each
Zod schema is attached to the right procedure and `TRPCError`s from the service propagate
through `createCaller` as rejections.

### 3.7 Files touched/created (summary)

New:
- `apps/server/src/services/event-service.ts`
- `apps/server/src/services/event-service.test.ts`
- `apps/server/src/routers/event-router.ts`
- `apps/server/src/routers/event-router.test.ts`

Modified:
- `apps/server/src/routers/app-router.ts` (mount `events: eventsRouter`)

Not touched: `apps/server/prisma/schema.prisma` / migrations (no schema change needed —
`date`/`notes`/`kind` already exist), `apps/server/prisma/seed.ts` (no seed events added;
the existing seed only creates tasks and this ticket doesn't need fixture events to prove
the procedures work — covered entirely by unit tests), `apps/server/src/services/
task-service.ts` / `apps/server/src/routers/task-router.ts` (untouched — this ticket adds
a sibling, doesn't modify the task side), anything under `apps/web/**` (no UI, per §1's
scope note), `apps/web/src/trpc.ts` (no `Event` type export — nothing in `apps/web`
consumes `events.*` yet).

## 4. Edge cases and error conditions to cover in tests

**Server — `EventService` (`event-service.test.ts`)**:
- `list`: filters `where: { kind: "event" }`, `orderBy: { date: "asc" }`; returns
  whatever the db resolves with, unmodified; returns `[]` when there are no matching
  rows.
- `create`: passes title/notes through unchanged (trimming happens upstream in the
  router's Zod schema, same division as `TaskService.create`); always passes `kind:
  "event"` regardless of anything else in the input (schema-level guarantee — there's no
  `kind` field to pass); converts a required `date` string (both date-only and
  date+time forms) into a real `Date` before the `db.entry.create` call; omitted `notes`
  → `data.notes` is `undefined`; provided `notes` → stored unchanged.
- `update`: unknown id → `NOT_FOUND`; id exists but `kind === "task"` → `NOT_FOUND` (the
  events router can't edit a task, mirroring `TaskService`'s existing reverse check);
  title-only update leaves `date`/`notes` untouched (assert `data.date === undefined` and
  `data.notes === undefined` in the actual call, not merely absent from the test's
  expectation object — same rigor `task-service.test.ts` already applies); a provided
  `date` string converts and replaces the existing date; `notes: null` clears existing
  notes; a provided non-empty `notes` string sets a new value.
- `delete`: unknown id → `NOT_FOUND`; id exists but is a task → `NOT_FOUND`; success calls
  `db.entry.delete` with `{ where: { id } }` and resolves to `{ id }`.

**Server — `eventsRouter` (`event-router.test.ts`)**: one happy-path `createCaller` test
per procedure (`list`, `create`, `update`, `delete`), proving each wires to the right
`EventService` method; validation-rejection tests: `create` rejects an empty title,
rejects a whitespace-only title, rejects a missing `date`, rejects a malformed `date`
string (e.g. `"07/26/2026"`); `update` rejects a malformed `date` string, rejects a
whitespace-only `title` when provided, accepts `notes: null` and passes it through as a
clear; `delete` rejects an empty `id`. Also: confirm there is no `toggleComplete`
procedure at all on `eventsRouter` (e.g. `expect((eventsRouter as any).toggleComplete)
.toBeUndefined()`, or equivalently, a compile-time check that `caller.events` has no such
method) — a direct, explicit assertion of the ticket's one call-out semantic difference,
not left to be implied by its absence.

**Explicitly not planned as a dedicated test** (so `reviewer-tests` doesn't expect it):
any test involving `apps/web` (no UI this ticket, §1); calendar-validity of a
regex-valid-but-calendar-invalid `date` string (§3.1 — same accepted, documented gap
Task CRUD already carries, not reachable without a UI yet); the TOCTOU race window in the
two-step existence-check-then-mutate pattern (same accepted tradeoff as `TaskService`);
seed-data/fixture events (no seed changes, §3.7).

## 5. Explicitly out of scope (scope boundary)

- **Any `apps/web` change** — no `EventService`/`eventsRouter` consumer, no event forms,
  no event list/calendar UI, no `Event` type export from `apps/web/src/trpc.ts`. Issue #7
  only asks for tRPC procedures; per README.md's MVP scope, the calendar view (which is
  presumably the eventual consumer of `events.list`) is FullCalendar-based work that
  hasn't been scoped into a ticket yet.
- **A "reminder" field, offset, or notification mechanism** (e.g. "remind me 30 minutes
  before") — per §2, "just a reminder" in both the issue and README describes an event's
  conceptual role (a fixed point in time to be reminded of, as opposed to a completable
  task), not a distinct feature to build. Nothing in this ticket implements notifications,
  reminder lead-time, or any reminder-specific field beyond the existing `date` column.
- **Recurrence** (recurring events) — not mentioned by the issue; a separate, larger
  future feature per the README's backlog framing.
- **Tags** (many-to-many `Tag` relation) — no procedures, no wiring, matching Task CRUD's
  identical scope cut for the same shared relation.
- **Any Prisma schema/migration change** — not needed; `Entry.date`/`Entry.notes` already
  exist and are exactly what this ticket's procedures touch.
- **Full timezone correctness for event dates** (§3.1) — the same known, documented,
  pre-existing app-wide gap Task CRUD already flagged for `dueDate`, not newly introduced
  or fixed here.
- **Calendar-validity checking of the `date` string** (§3.1/§4) — same accepted gap as
  Task CRUD's `dueDate`, carried over unchanged rather than fixed opportunistically while
  touching a similar validator.
- **Any change to `TaskService`/`tasksRouter`** — this ticket only adds a sibling; the
  task side is untouched, including its own `date`-adjacent gotchas already documented in
  `tickets/task-crud/plan.md`.

## 6. Open questions / judgment calls (flagged for visibility, none blocking)

1. **`date` is required on `create` and optional-but-not-nullable on `update`** (§3.1) —
   the one genuine ambiguity in this ticket. The issue's own emphasis on "date/time" as
   an event's defining trait, plus README's "just a reminder" framing, both read most
   naturally as "an event without a date/time isn't really an event," but the issue
   doesn't say "required" explicitly, and the schema column itself is nullable (of
   necessity, since it's shared with the task side, per §2). If this reading is wrong,
   it's a one-line loosening (§3.1) — no other part of this plan depends on it being
   required, since notes/title handling is unaffected either way.
2. **`date` cannot be cleared back to `null` via `update`** — a direct consequence of #1.
   If a future ticket needs "someday, no fixed time" events, this would need revisiting
   at the same time as #1.
3. **No shared base class between `TaskService`/`EventService`** despite their
   near-identical `list`/existence-check/`delete` shapes — deliberate, not an oversight.
   The two services differ enough in their `create`/`update` field sets (and will likely
   diverge further once a future ticket adds recurrence or a reminder concept to events
   specifically) that a shared abstraction now would be premature; `AGENT_RULES.md`
   itself frames tasks and events as sharing a *table*, not a service layer. Revisit if a
   third `kind` or a third near-identical service ever appears and the duplication starts
   costing real maintenance pain.
4. **`eventDateString`'s regex is duplicated in `event-router.ts` rather than extracted
   into a shared validator** (§3.3) — minor, low-stakes; matches the existing
   `task-router.ts` precedent of each router file being self-contained, and keeps the two
   "kept separate" kinds separate at the file level too.

None of these are blocking — each has a stated default and reasoning above.
