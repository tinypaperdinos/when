# Plan: shared zod schemas (GitHub issue #34)

## 1. What "done" means

Today, for each entity (`task`, `event`), the input shape for create/update is hand-written
twice: once as an inline TS object type on the service method's signature
(`task-service.ts`, `event-service.ts`), and once as a `z.object({...})` in the router
(`task-router.ts`, `event-router.ts`). The two can drift silently — nothing forces them to
stay in sync.

Done means:

- Each entity has exactly **one** zod schema definition per input shape (create, update),
  colocated with its service in a new `<entity>-schema.ts` file next to `<entity>-service.ts`.
- `<entity>-service.ts` method signatures for `create`/`update` use `z.infer<typeof schema>`-
  derived types instead of hand-duplicated inline object types. (Scalar params — `id: string`,
  `completed: boolean` — are left as plain primitives; see §4, "not doing.")
- `<entity>-router.ts` imports those same schemas for its `.input(...)` calls instead of
  redeclaring the shape locally. Where the router's wire input bundles fields the service
  takes as separate positional args (`update`, `toggleComplete` both take `id` separate from
  the body), the router composes the shared per-field schemas rather than re-typing them.
- This applies to **both** existing pairs: `task-service.ts`/`task-router.ts` (the reference
  implementation the issue's `## Scope` section names explicitly) and
  `event-service.ts`/`event-router.ts`. The issue's `## Scope` section only literally says to
  establish the pattern "before/alongside" `event-crud` (#7) so that *new* entities would
  follow it from the start — but `event-crud` merged (PR #33) in the interim without the
  pattern, before this ticket started. Applying the refactor to the event pair too is this
  plan's own scope decision, not a literal instruction from the issue — flagged explicitly as
  such, the same way §4 flags the title/notes non-sharing call. The reasoning: the issue's
  title ("...across service, router, and form layers") and Problem section describe drift
  between hand-duplicated shapes as a general problem, not one scoped to `task` specifically;
  leaving `event-router.ts`/`event-service.ts` with their own copies of the date regex and
  `idInput` while `task-router.ts`/`task-service.ts` get the shared versions would immediately
  reintroduce, in the sibling entity, the exact drift risk this ticket exists to close — i.e.
  stopping at the task pair wouldn't just leave event out, it would actively undermine the
  point of doing this at all. If the refiner disagrees and wants this scoped back to
  task-only, that's a plan change, not a hidden assumption — but the reasoning above is why
  the plan currently includes it.
- Genuinely byte-identical pieces shared *across* task and event today (the date/time regex
  validator, the `{ id }` input shape) are extracted once into a shared helper and reused by
  both entities' schema files, rather than pasted twice more. See §2.2 for exactly what is
  and isn't shared, and why.
- Pure refactor, no behavior change: every existing test in `task-service.test.ts`,
  `task-router.test.ts`, `event-service.test.ts`, `event-router.test.ts` continues to pass
  **unmodified**. The existing suite is the regression guard for this ticket; if any of those
  assertions need to change, that's a signal the refactor accidentally changed behavior, not
  that the test was wrong.
- `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` all still pass (CI's
  `build` job runs all four).

Non-goal (confirmed by the issue itself, quoted in "Problem"): the client form layer is *not*
part of this refactor. `trpc.<router>.create.mutate()` already infers its type from the
router's zod schema via `AppRouter`, and the `*Payload` helpers
(`apps/web/src/lib/task-due-date.ts`'s `dueDatePayload`) convert widget-specific local state
(`DateTimePickerValue`) into the wire shape — that's a legitimately different concern, not a
duplicate schema. Nothing in `apps/web` changes.

## 2. Task breakdown

### 2.1 New files

- **`apps/server/src/services/schema-helpers.ts`** (new) — the *only* cross-entity shared
  piece. Exports:
  - `wireDateTimeString` — the `z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid date")`
    validator, currently pasted verbatim as `dueDateString` in `task-router.ts` and
    `eventDateString` in `event-router.ts`.
  - `idInput` — the `z.object({ id: z.string().min(1) })` shape, currently pasted verbatim in
    both routers (used for `delete`, and merged into `update`/`toggleComplete`).

- **`apps/server/src/services/task-schema.ts`** (new) — colocated with `task-service.ts`.
  Exports:
  - `taskCreateInput = z.object({ title: z.string().trim().min(1, "Title is required"), dueDate: wireDateTimeString.optional(), notes: z.string().trim().optional() })`
  - `taskUpdateFields = z.object({ title: z.string().trim().min(1, "Title is required").optional(), dueDate: wireDateTimeString.nullable().optional(), notes: z.string().trim().nullable().optional() })`
  - `taskToggleCompleteFields = z.object({ completed: z.boolean() })`
  - `type TaskCreateInput = z.infer<typeof taskCreateInput>`
  - `type TaskUpdateInput = z.infer<typeof taskUpdateFields>`

- **`apps/server/src/services/event-schema.ts`** (new) — colocated with `event-service.ts`.
  Exports:
  - `eventCreateInput = z.object({ title: z.string().trim().min(1, "Title is required"), date: wireDateTimeString, notes: z.string().trim().optional() })`
  - `eventUpdateFields = z.object({ title: z.string().trim().min(1, "Title is required").optional(), date: wireDateTimeString.optional(), notes: z.string().trim().nullable().optional() })`
  - `type EventCreateInput = z.infer<typeof eventCreateInput>`
  - `type EventUpdateInput = z.infer<typeof eventUpdateFields>`

  Note the asymmetry vs. task is **preserved deliberately**: `date` on event-update is
  `.optional()` only (not `.nullable()`) — an event can't be cleared to "no date" the way a
  task's `dueDate` can, matching today's `event-router.ts`. Not a bug, not homogenized away.

### 2.2 Modified files

- **`apps/server/src/services/task-service.ts`** — replace the inline object types on
  `create`/`update` with `TaskCreateInput`/`TaskUpdateInput` imported from `./task-schema`.
  `toggleComplete(id: string, completed: boolean)` and `delete(id: string)` keep plain
  primitive param types (see §4).
- **`apps/server/src/services/event-service.ts`** — same treatment with
  `EventCreateInput`/`EventUpdateInput` from `./event-schema`.
- **`apps/server/src/routers/task-router.ts`** — delete the local `dueDateString`,
  `createInput`, `updateInput`, `idInput` definitions. Import `taskCreateInput`,
  `taskUpdateFields`, `taskToggleCompleteFields` from `../services/task-schema` and `idInput`
  from `../services/schema-helpers`. Use:
  - `create`: `.input(taskCreateInput)`
  - `update`: `.input(idInput.merge(taskUpdateFields))`, then destructure `{ id, ...rest }` as
    today
  - `toggleComplete`: `.input(idInput.merge(taskToggleCompleteFields))`
  - `delete`: `.input(idInput)`
- **`apps/server/src/routers/event-router.ts`** — same treatment with `eventCreateInput`,
  `eventUpdateFields`, and the shared `idInput` (no toggle-complete procedure on events, per
  existing test `"has no toggleComplete procedure"`).

### 2.3 No schema/data changes

`schema.prisma` is untouched — this is a TypeScript/Zod-layer refactor only, no migration.

### 2.4 Test files

No new test files planned (see §4 for why), but the four existing test files
(`task-service.test.ts`, `task-router.test.ts`, `event-service.test.ts`,
`event-router.test.ts`) must be run as-is after the refactor and pass unmodified — that's the
explicit acceptance check for "no behavior change." If implementation naturally makes any of
them fail, the fix is in the schema/service/router code, not in loosening the test.

## 3. Edge cases and error conditions (for reviewer-tests)

These are existing behaviors the refactor must not silently change — call out that
`zod`'s `.merge()` (used to combine `idInput` with `taskUpdateFields`/
`taskToggleCompleteFields`) doesn't alter per-field validation, but each of these should be
spot-checked against the existing (unmodified) test files rather than assumed:

- **Malformed `dueDate`/`date`** (e.g. `"07/26/2026"`) is still rejected on both create and
  update, for both entities — regex now lives in one shared place
  (`wireDateTimeString`), so a mistake in the extraction breaks validation for *both*
  entities at once, not just one — worth double-checking both `task-router.test.ts` and
  `event-router.test.ts`'s malformed-date cases pass.
- **Empty/whitespace-only `title`** is still rejected on create (required) and on update
  (optional field, but if present must be non-empty after trim) — for both entities.
- **Empty/whitespace-only `id`** is still rejected (`idInput`'s `min(1)`) — for `delete`,
  `update`, and `toggleComplete` (task only) on both entities, now sourced from one shared
  `idInput` instead of two copies.
- **`dueDate: null` on task update** still clears the due date (task's `dueDate` stays
  `.nullable().optional()`); **`date` on event update has no equivalent null/clear case**
  because it isn't nullable — this asymmetry must survive the refactor unchanged (see §2.1).
- **`notes: null` vs `notes: ""` vs `notes` omitted** — schema-level, all three remain valid
  (schema is `.trim().nullable().optional()` on update, `.trim().optional()` on create); the
  service-level *interpretation* of each (empty-string-after-trim collapses to `undefined` on
  create, `input.notes || null` on update) is business logic and must stay in the service
  method bodies, not move into the schema — the schema only says "valid shape," not "what it
  means." This is the main risk in this refactor: it would be easy to accidentally fold
  `notes ? notes : undefined`-style logic into a zod `.transform()` while "cleaning up," which
  would move behavior out of the service layer in violation of AGENT_RULES.md's "business
  logic lives in service classes" rule. Don't do that.
- **`toggleComplete` missing `completed`** still rejected (task only; field is required, no
  `.optional()`/default on `taskToggleCompleteFields`).
- **Type-level regression**: after switching service method signatures to
  `z.infer<...>`-derived types, the destructured `{ id, ...rest }` shape the router passes to
  `TaskService.update`/`EventService.update` must still structurally satisfy
  `TaskUpdateInput`/`EventUpdateInput` — a mismatch here is a compile-time break, not a
  runtime one, so it'll only surface via `npm run typecheck` / CI's `build` job, not via
  `vitest`. Confirm typecheck passes, don't rely solely on the test run being green.
- **Import cycle risk**: `task-schema.ts`/`event-schema.ts` are imported by both
  `task-service.ts`/`event-service.ts` (for types) and `task-router.ts`/`event-router.ts`
  (for schemas) — no risk of a cycle since the schema files don't import from either service
  or router, but worth confirming `schema-helpers.ts` also has no back-reference into
  `task-schema.ts`/`event-schema.ts` (it shouldn't need one).

## 4. Explicitly not doing (scope boundaries)

- **Not touching `apps/web`.** Confirmed above and in the issue itself: the client already
  consumes the router's inferred types via tRPC, and the `*Payload` helpers are a distinct
  concern (widget state to wire format), not a duplicate schema. Out of scope.
- **Not sharing `title`/`notes` field-level validators across task and event**, even though
  today's `title`/`notes` zod fragments happen to be textually identical between the two
  entities. Judgment call, flagged here rather than made silently: the issue's own "Scope"
  section frames the pattern as *per-entity* (schema colocated with its own service), and
  only explicitly calls out cross-file duplication *within* a task or event pair (service vs.
  router), not duplication *across* the task/event pair. Extracting `title`/`notes` into a
  shared builder would be a deeper, unrequested coupling — e.g. a future ticket giving tasks
  a different title length limit than events would have to *un*-share it. The two pieces this
  plan *does* share cross-entity (`idInput`, the date regex) are shared because they're
  structural/generic (not entity-specific business rules) and because a regex typo diverging
  between the two copies today would be a real, easy-to-miss bug. If the refiner disagrees
  and wants `title`/`notes` shared too, that's a small follow-up, not a plan rewrite.
- **Not deriving scalar service params (`id: string`, `completed: boolean`) from
  `z.infer<...>`.** These are single-field primitives, not shapes — there's no meaningful
  duplication risk in `id: string` appearing in two places the way a 3-field object literal
  has. Wiring `TaskService.toggleComplete`'s second param through
  `z.infer<typeof taskToggleCompleteFields>["completed"]` would add an import for zero
  drift-risk reduction. `idInput` itself is still shared (§2.1) because the *shape* it
  validates (`{ id: string }`, non-empty) is reused as a schema object composed into other
  router inputs, not because the underlying `id: string` service param needed it.
- **Not adding new `*-schema.test.ts` files.** The existing `task-router.test.ts`/
  `event-router.test.ts` already exercise every validation rule end-to-end via
  `appRouter.createCaller(...)` (malformed date, empty title, missing `completed`, etc.), and
  `task-service.test.ts`/`event-service.test.ts` explicitly say validation is "tested in
  task-router.test.ts" rather than duplicating it — consistent with that existing convention,
  this refactor relies on the same router tests (now importing the shared schemas instead of
  local ones) as its coverage, rather than adding a third, redundant layer of direct
  schema-unit tests for rules that don't change.
- **Not changing any validation *rules*** (no new min/max lengths, no new required fields,
  no format changes) — this ticket is a structural/DRY refactor of where schemas live and who
  owns them, not a validation-behavior change. If reviewer-code or reviewer-tests spot an
  actual behavior diff versus current `main`, that's a bug in the refactor, not an intentional
  part of this ticket.
- **Not touching `Tag`** — `schema.prisma` has a `Tag` model but no service/router exists for
  it yet; nothing to consolidate there.

## 5. Open question for plan-refiner

None blocking — the one judgment call (title/notes field-level sharing, §4) is stated with
reasoning above rather than left open, since a decision either way is low-cost to reverse and
picking one keeps this plan concrete. Flagging it explicitly so it's a deliberate choice to
challenge, not a silent gap.
