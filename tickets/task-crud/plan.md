# Plan: Task CRUD (issue #4)

Issue #4's full text (fetched via `gh issue view 4`):

> Create/update/delete/complete-toggle tRPC procedures on the Entry model (kind: task),
> plus minimal forms in apps/web. Currently the only way data gets into the app is the
> seed script (tasks.list is read-only) — this unblocks everything else in the backlog.
>
> Depends on: scaffold-project (merged, PR #3).

## 1. What "done" means

- `apps/server`'s `tasksRouter` gains four new mutations — `create`, `update`,
  `toggleComplete`, `delete` — operating exclusively on `Entry` rows where
  `kind: "task"`. Each is a thin tRPC procedure (Zod input validation only) delegating to
  new `TaskService` methods that hold the actual business logic (existence checks,
  trimming, due-date conversion), per `AGENT_RULES.md`'s "tRPC procedures are thin"
  convention. `tasks.list` (already read-only, already merged) is untouched.
- `apps/web`'s `TasksPage` grows from a read-only list into a page that can actually
  create a task, edit a task's title, toggle its completed state, and delete it — using
  the existing `components/ui/` primitives (`TextInput`, `Checkbox`, `Button`,
  `DateTimePicker`) rather than any new low-level primitive. No new generic `ui/`
  component is needed for this ticket.
- No Prisma schema/migration changes: the `Entry` model (`apps/server/prisma/schema.prisma`)
  already has every field this ticket needs (`title`, `dueDate`, `completed`, `kind`).
  This ticket is pure service/router/UI work.
- CI (`lint`, `typecheck`, `test`, `build`) stays green.

Non-goals (full list in §5): a `notes`/Notes-editor UI (explicitly deferred to issue #5,
per `tickets/form-primitives/plan.md`'s own reference to it), editing a task's due date
after creation via the UI (the `update` procedure supports it; only tested directly, not
wired to a form control this round), tags, events/`eventsRouter`, optimistic UI updates,
a confirmation-dialog component (plain `window.confirm()` instead), full timezone
correctness, pagination/filtering of `list`.

## 2. Context: what exists today

- `Entry` (schema.prisma): `id, kind (task|event), title, notes?, dueDate?, completed
  (default false), date?, createdAt, updatedAt, tags[]`. `Tag` is a separate model,
  many-to-many — untouched by this ticket.
- `TaskService` (`apps/server/src/services/task-service.ts`) currently has one method,
  `list()`, filtering `where: { kind: "task" }`. Constructed with a `PrismaClient` injected
  via constructor (`new TaskService(db)` in the router) — this ticket extends the same
  class in place, doesn't create a second service.
- `tasksRouter` (`apps/server/src/routers/task-router.ts`) currently has one procedure,
  `list` (a `publicProcedure.query`). No `zod` import yet in this file even though the
  server already depends on `zod ^4.4.3` (used nowhere yet — this ticket is its first use).
- `TasksPage` (`apps/web/src/routes/tasks-page.tsx`) is read-only: loading/error/empty/list
  states over `useQuery(trpc.tasks.list.queryOptions())`, rendering `<li>{task.title}</li>`.
  Its test file (`tasks-page.test.tsx`) mocks `fetch` at the `httpBatchLink` level with
  raw tRPC-batch JSON responses — same technique this ticket's new component tests reuse.
- Component library primitives available and already built/tested (from `form-primitives`
  and `date-time-picker` tickets): `Button` (primary/secondary/icon), `TextInput`,
  `Textarea`, `Checkbox`, `Select`, `DateTimePicker` (controlled-only,
  `{ date: string; time?: string }` value shape mirroring native `date`/`time` inputs),
  `DateRangePicker`. `Checkbox`/`DateTimePicker` are exactly the primitives issue #15
  named as future consumers of "task completion toggle" / a due-date field — this ticket
  is that consumer.
- **Known gotcha this plan must respect** (`AGENT_RULES.md`, "`Date` fields cross the
  tRPC boundary as plain strings"): no `superjson` transformer is configured, so
  `AppRouter`'s inferred TypeScript type says `dueDate: Date | null` but the actual
  runtime value received by the web app is a string (e.g. `"2026-07-26T00:00:00.000Z"`).
  Any code that calls a `Date` method on `task.dueDate` (formatting for display) must
  first do `new Date(task.dueDate)` — the plan below calls this out at every touch point
  rather than assuming the inferred type is trustworthy.
- No shared package between `apps/web`/`apps/server` (root `package.json` workspaces are
  only `apps/*`) — the `dueDate` wire-string format this plan defines (§3.1) is a
  contract documented here, not shared code, and is independently implemented/validated
  on both sides.

## 3. Task breakdown

### 3.1 Wire contract for `dueDate` (documented here, implemented independently on both sides)

A task's `dueDate`, when sent from web → server, is one of:
- absent from the input object entirely (create: "no due date"; update: "don't change it"),
- `null` (update only: "clear the existing due date"),
- a string matching exactly `"YYYY-MM-DD"` or `"YYYY-MM-DDTHH:mm"` — i.e. the native
  `<input type="date">` value, optionally joined with `"T"` + the native
  `<input type="time">` value. This mirrors `DateTimePickerValue`'s own `date`/`time`
  fields exactly, so the client-side conversion is a one-line join
  (`value.time ? \`${value.date}T${value.time}\` : value.date`, or `undefined` when
  `value.date === ""`), and the server-side check is an exact regex, not a lenient
  `Date.parse`.

Server validates with `z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid
date")` and converts to a `Date` via `new Date(theString)` before handing to Prisma.

**Documented, not fixed, limitation**: per JS's `Date` parsing rules, a date-only string
(`"YYYY-MM-DD"`) is parsed as UTC midnight, while a date+time string
(`"YYYY-MM-DDTHH:mm"`) is parsed as local time — an inherent inconsistency in the
built-in parser, not a bug this plan introduces. In a timezone behind UTC, a date-only
due date could display as the previous day. Not addressed here: no part of this app
handles timezones yet, and this ticket doesn't introduce the first instance of that
problem — flagged for whichever future ticket first needs timezone-correct dates.

Format validity (regex) is checked; calendar validity (e.g. rejecting `"2026-13-45"`) is
not — the client only ever produces valid dates via native `date`/`time` inputs, so this
only matters for a direct/malicious API call. **Corrected reasoning (verified via `node
-e`; see `refiner-notes.md` round 1, finding 2 — an earlier draft of this plan claimed
Prisma would simply error on an `Invalid Date` here, which is wrong and is being
corrected rather than left as an inaccurate safety-net claim):** JS's `Date` constructor
does **not** reject most regex-valid-but-calendar-invalid strings — it silently
normalizes them instead. `new Date("2026-02-30")` becomes `2026-03-02T00:00:00.000Z`;
`new Date("2026-04-31")` becomes `2026-05-01T00:00:00.000Z`. Prisma then persists that
normalized (and simply wrong) date with no error at all. Only a narrower subset of
malformed strings — where a component is far enough out of range that `Date`'s own
normalization logic can't resolve it (the plan's own example, `"2026-13-45"`, has an
out-of-range month) — actually produces a genuine `Invalid Date`, which Prisma **will**
reject (this part of the original claim happened to be correct, just not generalizable to
"calendar-invalid" as a whole). Net effect: a regex-valid, calendar-invalid `dueDate` sent
via a direct API call most likely **silently persists as a different, incorrect date**,
not a 500. This still isn't being fixed here — it remains reachable only via a
direct/malicious API call, since the native `date`/`time` inputs always produce
calendar-valid values — but the plan's prior "Prisma will error" framing is removed so no
future reader mistakes it for an accurate safety net.

### 3.2 `apps/server/src/routers/task-router.ts` (modified)

Add four Zod schemas and four mutations, alongside the existing `list` query:

```ts
const dueDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid date");

const createInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  dueDate: dueDateString.optional(),
});

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").optional(),
  dueDate: dueDateString.nullable().optional(),
});

const idInput = z.object({ id: z.string().min(1) });

const toggleCompleteInput = z.object({
  id: z.string().min(1),
  completed: z.boolean(),
});
```

Procedures: `create` (mutation, `createInput` → `TaskService.create`), `update`
(mutation, `updateInput` → splits `id` from the rest → `TaskService.update(id, rest)`),
`toggleComplete` (mutation, `toggleCompleteInput` → `TaskService.toggleComplete(id,
completed)`), `delete` (mutation, `idInput` → `TaskService.delete(id)`). No `.output()`
schema on any of these — matches existing `list`'s precedent of relying on Prisma's
inferred return type through tRPC.

**Naming/semantics judgment call (flagged, see §6.1)**: the issue says "complete-toggle,"
so the procedure is named `toggleComplete` — but it takes an explicit `completed: boolean`
input rather than flipping the current value server-side with no input beyond `id`. This
is deliberate: the web `Checkbox`'s `onChange` handler already knows its own next value
(`e.target.checked`) without needing to consult the currently-rendered `task.completed`
first, and an explicit-value call is idempotent (calling it twice with the same payload
is a no-op the second time), whereas a server-side flip is not (a double-click or a
retried network request would flip it back). `toggleComplete` is the name; "set, not
flip" is the implementation.

`title` is `.optional()` on `update` (unlike `create`, where it's required) — a task must
have a title on creation, but a partial update (e.g. only toggling due date, if a future
UI ever exposes that) shouldn't be forced to resend the title.

### 3.3 `apps/server/src/services/task-service.ts` (modified)

Add a private helper and four public methods, alongside the existing `list()`:

```ts
private async assertTaskExists(id: string) {
  const existing = await this.db.entry.findUnique({ where: { id } });
  if (!existing || existing.kind !== "task") {
    throw new TRPCError({ code: "NOT_FOUND", message: `Task ${id} not found` });
  }
}

async create(input: { title: string; dueDate?: string }) {
  return this.db.entry.create({
    data: {
      kind: "task",
      title: input.title,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    },
  });
}

async update(id: string, input: { title?: string; dueDate?: string | null }) {
  await this.assertTaskExists(id);
  return this.db.entry.update({
    where: { id },
    data: {
      title: input.title,
      dueDate:
        input.dueDate === undefined
          ? undefined
          : input.dueDate === null
            ? null
            : new Date(input.dueDate),
    },
  });
}

async toggleComplete(id: string, completed: boolean) {
  await this.assertTaskExists(id);
  return this.db.entry.update({ where: { id }, data: { completed } });
}

async delete(id: string) {
  await this.assertTaskExists(id);
  await this.db.entry.delete({ where: { id } });
  return { id };
}
```

Design notes:
- `create()` **hardcodes `kind: "task"`** — `createInput` has no `kind`/`completed` field
  at all, so there's no way through this router to spoof an event-kind row or preset
  `completed: true` on creation; `completed` relies on the Prisma schema's own
  `@default(false)`.
- **Existence/kind check via a separate `findUnique` before the mutation, not a combined
  `where: { id, kind: "task" }` on `update`/`delete` itself.** Prisma does support
  extended `where` filters on unique operations, which would make the check atomic (no
  TOCTOU gap) — but it pushes distinguishing "not found" from "found but wrong kind" into
  parsing a Prisma error code (`P2025`) rather than a plain `if`, and it's harder to unit
  test against a mocked `db` object (would need a real
  `Prisma.PrismaClientKnownRequestError` instance rather than a plain rejected/resolved
  mock, breaking the existing `task-service.test.ts` fake-db pattern). The two-step
  approach accepts a narrow, single-user-dev-SQLite-scale TOCTOU race (a delete
  racing another delete between the check and the mutation) as a reasonable tradeoff for
  simplicity and testability — flagged in §6.2 as contestable if this were a
  multi-user production concern, which it isn't yet.
- **`TRPCError` thrown directly from the service class**, not a custom domain error
  translated at the router layer. `@trpc/server` is already a dependency of `TaskService`'s
  only consumer; introducing a domain-specific `NotFoundError` class (translated to
  `TRPCError` in the router) would be more layered/correct in a codebase with multiple
  transports, but this app has exactly one (tRPC), so the extra indirection isn't earning
  its complexity yet. Flagged in §6.3 as a judgment call.
- `update()`'s `data` object passes `title: input.title` even when `undefined` —
  intentional, not a bug: Prisma treats an `undefined` value in `data` as "don't touch
  this field," distinct from an explicit `null` ("set it to NULL"). This is why partial
  updates (title-only) don't need to be conditionally spread.
- `delete()` returns `{ id }`, not the deleted row — deliberate, minor asymmetry vs.
  `create`/`update` (which return the full `Entry`): the client only needs confirmation
  of which id was removed, not the (now-gone) row's full shape.

### 3.4 `apps/server/src/services/task-service.test.ts` (modified)

Extend the existing fake-db pattern (`vi.fn().mockResolvedValue(...)` per Prisma method
used) with new `describe` blocks for `create`, `update`, `toggleComplete`, `delete` — see
§4 for the exact edge-case list each block must cover.

### 3.5 `apps/server/src/routers/task-router.test.ts` (modified)

Extend the existing `createCaller` + mocked `../db` module pattern with one happy-path
test and one validation-rejection test per new procedure, proving each Zod schema is
attached to the right procedure and errors propagate through the router as expected
(matches the existing "wires the router to TaskService.list() via createCaller" test's
shape/intent). Deep edge-case coverage (existence/kind checks, partial-update semantics,
etc.) lives in `task-service.test.ts` (§3.4), not duplicated here.

### 3.6 `apps/web/src/trpc.ts` (modified) — derive a `Task` type without a new dependency

```ts
export type Task = Awaited<ReturnType<typeof trpcClient.tasks.list.query>>[number];
```

Reuses the already-exported `trpcClient` (the vanilla client, not the React-Query-bound
`useTRPC`) to derive the per-row type from `AppRouter`'s real inferred output, rather than
hand-writing a matching interface (per `AGENT_RULES.md`: "never hand-write a manual type
for API responses"). Avoids adding `@trpc/server` as an explicit new `apps/web`
dependency just for `inferRouterOutputs` — `Task["dueDate"]`/`Task["completed"]` etc. are
whatever `AppRouter`'s `tasks.list` procedure actually returns, kept in sync automatically
as the router changes. **Reminder (per §2's gotcha): `Task["dueDate"]`'s inferred type is
`Date | null`, but the runtime value is a string** — every consumer of this type that
touches `dueDate` must `new Date(task.dueDate)` before calling any `Date` method; the
type checker will not catch a missed conversion.

### 3.7 `apps/web/src/lib/task-due-date.ts` (new) + colocated test

```ts
import type { DateTimePickerValue } from "../components/ui/date-time-picker";

export function dueDatePayload(value: DateTimePickerValue): string | undefined {
  if (!value.date) return undefined;
  return value.time ? `${value.date}T${value.time}` : value.date;
}
```

One small pure function, matching the `src/lib/cn.ts` precedent (colocated
`task-due-date.test.ts`) of a standalone-tested helper under `src/lib/`. Only the
create-direction conversion is needed (§3.9/§3.10 below explain why the reverse direction
— wire string back to a `DateTimePickerValue` for pre-filling an editable field — isn't
needed by this ticket's UI).

**Deliberate, documented behavior** (called out explicitly per `refiner-notes.md` round 1
so it isn't mistaken for an unconsidered gap): `dueDatePayload` also silently drops a
time-without-date entry — `{ date: "", time: "14:30" }` → `undefined`. This is reachable
through the real `DateTimePicker` UI (a user can toggle "Add time" on and fill in a time
before ever touching the date field), not a purely hypothetical malformed input. Treating
"time but no date" as "no due date at all," rather than surfacing a validation error
telling the user to also pick a date, is the chosen behavior here — a due date with only a
time and no day isn't meaningful, and adding a dedicated validation-error UI path for this
one combination is more than a "minimal forms" ticket needs.

### 3.8 `apps/web/src/routes/task-create-form.tsx` (new) + colocated test

Minimal creation form, rendered above the list in `TasksPage`:

- Local state: `title: string`, `dueDateValue: DateTimePickerValue` (`{ date: "" }`).
- `TextInput` (controlled, `required`, placeholder e.g. "Add a task…") + `DateTimePicker`
  (controlled, `dateLabel="Due date"`) + `Button type="submit"` ("Add task").
- Uses `useMutation(trpc.tasks.create.mutationOptions({ onSuccess: ... }))` — on success:
  invalidate `trpc.tasks.list.queryKey()` via `useQueryClient()`, and reset both local
  state fields.
- Submit handler explicitly guards against an empty/whitespace-only title before calling
  `mutate` — needed because `fireEvent.submit` in a jsdom test bypasses the native
  `required` attribute's browser-level block, so this is real, testable client-side
  behavior, not just a server round-trip away from being caught.
- While `createMutation.isPending`, the submit button is disabled (prevents double-submit).
- On `createMutation.isError`, render `createMutation.error?.message` in a short inline
  paragraph, and — unlike the success path — leave `title`/`dueDateValue` untouched, so
  the user doesn't lose what they typed.
- Payload: `{ title: title.trim(), dueDate: dueDatePayload(dueDateValue) }`.

### 3.9 `apps/web/src/routes/task-list-item.tsx` (new) + colocated test

One row per task, replacing the current `<li>{task.title}</li>`:

- Props: `{ task: Task }` (the type from §3.6).
- **Not editing** (default): a `Checkbox` whose `label` is the task's title (clicking the
  label text toggles it too, via `Checkbox`'s native label-wrap behavior — no separate
  title element needed), `checked={task.completed ?? false}` (defensive default — see
  below), `onChange` calls `useMutation(trpc.tasks.toggleComplete.mutationOptions(...))`
  with `{ id: task.id, completed: e.target.checked }` — the checkbox's own new value, not
  a re-read of `task.completed`. When `task.completed` is true, the title text renders
  with a `line-through` class (cheap, direct visual confirmation the toggle worked; not a
  new component). If `task.dueDate` is present, a small "Due <formatted date>" line
  renders below, via `new Date(task.dueDate).toLocaleDateString()` — **never** calling a
  `Date` method on `task.dueDate` directly (§2/§3.6 gotcha). An "Edit" button (`Button
  variant="secondary" size="sm"`) enters edit mode; a "Delete" button (`Button
  variant="secondary" size="sm"`, visible text "Delete" — not the `icon` variant, so no
  `aria-label` requirement to manage) calls `window.confirm(...)` and, only if confirmed,
  calls `useMutation(trpc.tasks.delete.mutationOptions(...))` with `{ id: task.id }`.
- **Editing**: local state `editTitle: string`, seeded from `task.title` when "Edit" is
  clicked. Renders a `TextInput` (controlled by `editTitle`) plus "Save"/"Cancel"
  buttons. "Save" calls `useMutation(trpc.tasks.update.mutationOptions(...))` with `{ id:
  task.id, title: editTitle.trim() }` (no `dueDate` key — see §3.10 for why this ticket's
  UI doesn't expose due-date editing) and, on success, exits edit mode. "Cancel" exits
  edit mode without calling `update`, discarding `editTitle`.
- Each of the three mutations (`toggleComplete`, `update`, `delete`) invalidates
  `trpc.tasks.list.queryKey()` on success, independently — no callback props threaded
  from `TasksPage`; each mutation is owned by `TaskListItem` itself.
- **Error handling for all three mutations** (added in this revision to close a real gap
  raised in `refiner-notes.md` round 1, finding 1): `TaskCreateForm` (§3.8) already renders
  an inline error on `isError`; `TaskListItem`'s three mutations get the same treatment,
  not silent failure. The prior draft of this plan left these three mutations with no
  error UI at all, which was inconsistent given `NOT_FOUND` is a real, explicitly tested
  failure mode for exactly these three service methods (§3.3/§4). Concretely:
  - `toggleCompleteMutation.isError` → render a short inline paragraph below the checkbox
    row (e.g. `Couldn't update task: {toggleCompleteMutation.error?.message}`). Since this
    ticket does no optimistic update (mutate-then-invalidate-on-success only), a failed
    toggle never touches cached data, so the checkbox already reflects the real,
    unchanged server state with no separate revert logic needed — the message is purely
    informational.
  - `deleteMutation.isError` → render the equivalent inline paragraph below the row (e.g.
    a `NOT_FOUND` from a delete racing another delete, per §3.3/§6.2's documented TOCTOU
    gap, now surfaces as a real, user-visible message instead of a silent no-op that
    leaves the row sitting there with no explanation).
  - `updateMutation.isError` → render the equivalent inline paragraph inside edit mode,
    near the Save/Cancel buttons, and — mirroring `TaskCreateForm`'s "don't discard what
    the user typed on error" behavior — **stay in edit mode** with `editTitle` untouched
    rather than exiting, so a failed Save doesn't lose the in-progress edit.
  - None of the three add retry logic or auto-dismiss timers — a static inline message
    until the next attempt (or a page refresh) is the same minimal treatment
    `TaskCreateForm` already uses; this matches an existing pattern rather than inventing
    a new one.
- **Defensive default** (`task.completed ?? false`): kept, but with a narrower rationale
  than an earlier draft of this plan stated (corrected per `refiner-notes.md` round 1,
  finding 3 — the earlier framing overstated the risk). The `Entry` model's `completed`
  field has a Prisma `@default(false)` and is never optional in the real `tasks.list`
  response, so this default cannot actually trigger against real server data — only
  against this ticket's own simplified test fixtures (and the pre-existing
  `tasks-page.test.tsx` fixture, prior to §3.11's update, which only included `{ id,
  title }`). Kept anyway as a cheap, harmless default rather than justified by a
  "legacy-shaped row" risk that doesn't actually exist for this field. The due-date line
  being omitted when `task.dueDate` is null/undefined is, by contrast, a real and common
  case (any task created without a due date), not just a test-fixture concern.

### 3.10 Scope cut: due-date editing is not wired to the UI this round

`update`'s procedure/service fully supports changing (or clearing) `dueDate` (§3.2/§3.3,
tested directly in `task-service.test.ts`/`task-router.test.ts`), but `task-list-item.tsx`'s
edit mode only exposes the title field. Rationale: due dates are set at creation time via
`TaskCreateForm`'s `DateTimePicker` (a real, working feature), and adding due-date editing
to the inline edit row would require round-tripping a wire `dueDate` string back into a
`DateTimePickerValue` (splitting `"YYYY-MM-DDTHH:mm"` back into separate `date`/`time`
fields) — solvable, but extra surface this "minimal forms" ticket doesn't need in order to
prove `update` works end-to-end (editing the title already does that). Flagged in §6.4 as
the most contestable scope cut in this plan.

### 3.11 `apps/web/src/routes/tasks-page.tsx` (modified) + `tasks-page.test.tsx` (modified)

`TasksPage` renders `<TaskCreateForm />` above the existing loading/error/empty/list
states, and — once `data` is non-empty — `data.map((task) => <TaskListItem key={task.id}
task={task} />)` instead of the current `<li>{task.title}</li>`. Loading/error/empty
states themselves are untouched (regression-tested, §4).

`tasks-page.test.tsx`'s existing "populated list" fixture (`{ id: "1", title: "Buy milk"
}`) is updated to a realistic full row (`kind: "task", completed: false, dueDate: null`,
etc.) so the populated-list test is exercising `TaskListItem` meaningfully rather than a
row missing half its fields by omission.

### 3.12 Files touched/created (summary)

New:
- `apps/server/src/routers/task-router.test.ts` — modified, not new (see above); listed
  here only to avoid ambiguity: no new server test *files*, both existing server test
  files are extended in place.
- `apps/web/src/lib/task-due-date.ts`, `task-due-date.test.ts`
- `apps/web/src/routes/task-create-form.tsx`, `task-create-form.test.tsx`
- `apps/web/src/routes/task-list-item.tsx`, `task-list-item.test.tsx`

Modified:
- `apps/server/src/routers/task-router.ts`, `task-router.test.ts`
- `apps/server/src/services/task-service.ts`, `task-service.test.ts`
- `apps/web/src/trpc.ts` (+ `Task` type export)
- `apps/web/src/routes/tasks-page.tsx`, `tasks-page.test.tsx`

Not touched: `apps/server/prisma/schema.prisma` / migrations (no schema change needed),
`apps/server/prisma/seed.ts`, `apps/web/src/components/ui/**` (no new/changed generic
primitive — this ticket only *consumes* existing ones), `apps/web/src/routes/ui-demo-page.tsx`
(feature components under `src/routes/` aren't demo-registered — that convention is
specifically for `components/ui/`), `apps/web/src/router.ts`/`root-route.tsx` (no new
route — everything lands on the existing `/` route), `package.json`/`package-lock.json`
on either app (no new dependency).

## 4. Edge cases and error conditions to cover in tests

**Server — `TaskService` (`task-service.test.ts`)**:
- `create`: trims a padded title before persisting; rejects empty/whitespace-only title
  (`BAD_REQUEST`, asserted at the schema/router level — see below); always passes
  `kind: "task"` regardless of anything else in the input (schema-level guarantee: there
  is no `kind` field to pass); omitted `dueDate` → Prisma `data.dueDate` is `undefined`
  (stored as `null` by Prisma); provided `dueDate` (both date-only and date+time forms)
  → converted to a real `Date` before the `db.entry.create` call (assert the exact `Date`
  value/`data` object passed to the mocked `db`).
- `update`: unknown id → `NOT_FOUND`; id exists but `kind === "event"` → `NOT_FOUND`
  (can't edit an event through the tasks router); title-only update leaves `dueDate`
  untouched (assert `data.dueDate === undefined` in the call, not merely "not present in
  my test's expectation" — the mocked db call must show `undefined`, distinct from
  `null`); `dueDate: null` clears an existing due date (assert `data.dueDate === null`);
  `dueDate: "<valid string>"` converts and sets a new due date.
- `toggleComplete`: unknown id → `NOT_FOUND`; id exists but is an event → `NOT_FOUND`;
  sets exactly the passed boolean in both directions (`true` and `false`), and calling it
  twice with the same `completed: true` payload is a no-op the second time (idempotent —
  proves this is a "set," not a "flip," per §3.2's naming note).
- `delete`: unknown id → `NOT_FOUND`; id exists but is an event → `NOT_FOUND`; success
  calls `db.entry.delete` with `{ where: { id } }` and resolves to `{ id }`.

**Server — `tasksRouter` (`task-router.test.ts`)**: one happy-path `createCaller` test
and one validation-rejection test (e.g. empty title, or a malformed `dueDate` string like
`"07/26/2026"`) per new procedure — proves each Zod schema is wired to the right
procedure and that `TRPCError`s from the service propagate through `createCaller` as
rejections (matching the existing `list` test's "wires the router to TaskService.X() via
createCaller" shape).

**Web — `task-due-date.ts`**: empty `date` → `undefined`; date-only value → returned
unchanged; date+time value → joined with `"T"`; time-with-no-date (`{ date: "", time:
"14:30" }`) → `undefined` (the documented deliberate-drop behavior from §3.7, given its
own assertion rather than left implicit).

**Web — `TaskCreateForm`**: submitting a filled title (with and without a due date)
calls `create` with the trimmed title and the corresponding `dueDate` payload (present or
omitted); submitting an empty/whitespace-only title does not call the mutation; on
success, both fields reset; on mutation error, an inline error message renders and fields
are **not** reset; submit button is disabled while the mutation is pending.

**Web — `TaskListItem`**: checkbox reflects `task.completed` (including the
`undefined`-defaults-to-unchecked case for a partial fixture); toggling calls
`toggleComplete` with `{ id, completed: <new value> }` (not the old value); due date
renders as formatted text when present, omitted when `null`; clicking "Edit" shows a
title field pre-filled with the current title; "Save" calls `update` with the trimmed
edited title and exits edit mode; "Cancel" exits edit mode without calling `update` and
discards the typed change; "Delete" triggers `window.confirm` (mocked via
`vi.spyOn(window, "confirm")`), calling `delete` only when confirmed, not when cancelled.
**New in this revision (closing `refiner-notes.md` round 1, finding 1's gap):** when
`toggleCompleteMutation` rejects (e.g. a mocked `NOT_FOUND`), an inline error message
renders and the checkbox's displayed state is unaffected (no optimistic flip to revert,
since none was ever applied); when `updateMutation` rejects, an inline error message
renders inside edit mode and edit mode stays open with `editTitle` preserved (not reverted
to `task.title`, not exited); when `deleteMutation` rejects (confirmed by the user, but
the mutation itself fails server-side), an inline error message renders and the row
remains present in the list.

**Web — `TasksPage`**: existing loading/error/empty-list assertions still pass unchanged
(regression); the create form renders alongside the list; the updated, fuller fixture in
the populated-list test renders via `TaskListItem` (e.g. its title is still queryable via
`getByText`, proving the swap from `<li>` to `TaskListItem` didn't change what's visible).

**Explicitly not planned as a dedicated test** (so `reviewer-tests` doesn't expect it):
due-date *editing* via the UI (§3.10 — not wired this round; `update`'s `dueDate` path is
covered directly against the service/router instead); exact Tailwind class-string
snapshots on the new components (matches existing `Button`/`Card`/`Panel` precedent);
calendar-validity of a malformed-but-regex-matching `dueDate` string (§3.1 — accepted gap,
only reachable via a direct API call bypassing the native date/time inputs); the
TOCTOU race window in the two-step existence-check-then-mutate pattern (§3.3 — a
single-user-dev-SQLite-scale risk, not exercised as a concurrency test); any test
asserting on `notes`, tags, or event-kind entries (out of scope, §5).

## 5. Explicitly out of scope (scope boundary)

- **`notes` field — no input on `create`/`update`, no `Textarea` in any form.** Deferred
  entirely to issue #5 ("Notes"), which `tickets/form-primitives/plan.md` already
  references as the dedicated future consumer of `Textarea`. Adding `notes` handling here
  (validation rules, whether it's required, max length, etc.) would be guessing at
  decisions that ticket should make deliberately.
- **Editing a task's due date via the UI** (§3.10) — the backend fully supports it; the
  UI doesn't expose it this round.
- **Tags** (many-to-many `Tag` relation) — no procedures, no UI. A separate future
  backlog item per the data-model note in `AGENT_RULES.md`.
- **Events / an `eventsRouter`** — this ticket only touches the `kind: "task"` slice of
  the shared `Entry` model, exactly as scoped by the issue text ("on the Entry model
  (kind: task)").
- **Optimistic UI updates** for the checkbox/delete/edit actions — plain
  mutate-then-invalidate-then-refetch. A snappier optimistic-update experience is a
  future enhancement, not requested here. (This also means the new error-handling added
  in §3.9 needs no revert/rollback logic on failure — nothing was optimistically applied
  in the first place.)
- **A confirmation-dialog `ui/` primitive** — `window.confirm()` is used directly for
  delete confirmation instead of building a new modal/dialog component; no such
  primitive exists yet and building one is a larger, separate piece of work.
- **Full timezone correctness for due dates** (§3.1) — a known, documented, pre-existing
  gap in how the whole app currently treats dates, not newly introduced or fixed here.
- **Bulk operations, undo-after-delete, `list` pagination/filtering, calendar view,
  recurrence, overdue-highlighting** — all separate backlog items untouched by this
  ticket.
- **Any Prisma schema/migration change** — not needed; the `Entry` model already has
  every field this ticket's procedures touch.
- **Retry buttons/auto-dismiss timers on the new inline mutation-error messages** (§3.9)
  — a static message until the next user action is the same minimal treatment
  `TaskCreateForm` already uses; a richer error-recovery UX is a future enhancement, not
  requested here.

## 6. Open questions / judgment calls (flagged for visibility, none blocking)

1. **`toggleComplete` takes an explicit `completed` boolean rather than flipping
   server-side with no input beyond `id`** (§3.2). Resolved in favor of the explicit
   value for idempotency; the issue's wording ("complete-toggle") could be read as
   wanting a true flip — if so, that's a one-line change (drop `completed` from the
   input, compute `!existing.completed` in the service) once `assertTaskExists` already
   fetches the row.
2. **Existence/kind check is a separate `findUnique` before `update`/`delete`, not a
   single atomic `where: { id, kind: "task" }` mutation** (§3.3) — a deliberate
   testability/simplicity tradeoff accepting a narrow TOCTOU race, reasonable at this
   app's current single-user-dev-SQLite scale but worth revisiting if/when that changes.
3. **`TRPCError` thrown directly from `TaskService`**, not translated from a
   transport-agnostic domain error at the router layer (§3.3) — pragmatic for a
   single-transport (tRPC-only) app; would need revisiting if a second transport (e.g. a
   CLI or a webhook handler) ever called into `TaskService` directly.
4. **Due-date editing isn't wired to the UI this round** (§3.10) — the most contestable
   scope cut here; flagged in case "minimal forms" was intended to mean "every field
   editable," not "every procedure exercised by at least one form."

None of these are blocking — each has a stated default and reasoning above.

## 7. Revision history

- **Round 1** (`refiner-notes.md`): addressed finding 1 (real gap — added inline
  `isError` handling + tests for `TaskListItem`'s `toggleComplete`/`update`/`delete`
  mutations, §3.9/§4/§5) by design, not by leaving it for the implementer to improvise;
  addressed finding 2 (factual correction — §3.1's "Prisma will simply error on an
  Invalid Date" claim was wrong; corrected with the actual `Date`-normalization
  behavior); addressed finding 3/the two minor observations (§3.7's `dueDatePayload`
  time-without-date drop is now called out as a deliberate documented choice; §3.9's
  `task.completed ?? false` rationale no longer overstates a "legacy-shaped rows" risk
  that the schema doesn't actually allow). Scope framing, `toggleComplete`'s
  explicit-value design, and the notes/tags/events boundary were approved as-is and left
  unchanged.
</content>
