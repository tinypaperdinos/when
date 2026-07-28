# Plan: Tags (GitHub issue #6)

## 1. What "done" means

Issue #6's full text (via `gh issue view 6`):

> Expose the Tag relation already in the Prisma schema via tRPC (create/assign/remove
> tags on a task), and show tags in the task list UI. Tags distinguish tasks from each
> other — not separate collections/projects, per README MVP scope.
>
> Depends on: Task CRUD (#4).
>
> Also depends on the component library (#14 setup, #17 tag input + badge/chip) — tag
> assignment and display should use those shared components.

All three dependencies are done: Task CRUD (#4, `task-crud` ticket), component library
setup (#14), and `TagInput`/`Badge` (#17, `tag-input-badge` ticket, already registered on
`/dev/ui`). `schema.prisma`'s `Tag` model and the implicit `Entry`-`Tag` many-to-many join
table already exist from the initial migration (`20260725111646_init`) — **no new Prisma
migration is needed for this ticket**, confirmed by reading `migration.sql`.

Done means:

- A `TagService` (new, `apps/server/src/services/tag-service.ts`) exposes reading all
  tags and resolving a list of typed tag *names* into connect-refs for an `Entry` write,
  matching this repo's OOP-service convention.
- A new `tagsRouter` (`apps/server/src/routers/tags-router.ts`, registered on `appRouter`
  as `tags`) exposes `tags.list` — the read side of "expose the Tag relation via tRPC."
- `tasksRouter`'s existing `create`/`update` procedures gain an optional `tags: string[]`
  field (via `task-schema.ts`), and `TaskService.create`/`update`/`list` are extended to
  write/read the `Entry.tags` relation. This is the write side ("create/assign/remove
  tags on a task") — see §2.2 for why this is one endpoint extension rather than three
  new procedures.
- `TaskCreateForm` and `TaskListItem` (`apps/web/src/routes/`) are extended — not
  rebuilt — to let a user assign tags when creating a task and add/remove tags when
  editing one, using `TagInput`, and `TaskListItem`'s read view renders each task's tags
  using `Badge`. `TasksPage` fetches the all-tags suggestion list once and threads it
  down (§2.4).
- New/updated tests at every layer touched (§3), and CI (`lint`, `typecheck`, `test`,
  `build`) stays green.
- This ticket is also the "future ticket" that `tickets/tag-input-badge/plan.md` §2.3
  explicitly deferred two decisions to: how a freeform-typed tag name maps onto
  `Tag.name @unique`, and who fetches the live tag list and passes it into `TagInput` as
  `suggestions`. Both are resolved here, with reasoning, in §2.3 and §2.4.

Non-goals (full list in §5): event tagging, a tag-deletion/rename endpoint, per-tag
color, tag-based filtering/grouping of the task list (that's #8's job), any Prisma
migration, any change to `components/ui/tag-input.tsx`/`badge.tsx` (both already done).

## 2. Scope decisions (flagged explicitly, per this repo's planning convention)

### 2.1 Task-only, not event-generic — and this is a *deliberate* narrower call than the `shared-zod-schemas` ticket made

`AGENT_RULES.md`'s data-model paragraph describes tags as "a many-to-many relation on
[the] entity" (singular `Entry`, not "on tasks"), and the underlying `Tag` model has no
`kind` field — structurally, nothing stops an event from having tags too. This is the
same shape of question the `shared-zod-schemas` ticket faced (task-specific issue
wording vs. a data model that's actually entity-generic), and that ticket's plan
deliberately extended scope to both `task` and `event`. This ticket makes the **opposite**
call, for a reason specific to this issue rather than a different read of the same
reasoning:

- The issue's own title is "Tags" but its body says, twice, "tags on a **task**" — not
  "an entry." That's not just the issue's framing; the repo's own `README.md` MVP scope
  list independently says **"Tags on tasks, to tell them apart (not separate
  collections/projects)"** — tasks specifically, with no equivalent bullet for events.
  Unlike `shared-zod-schemas` (where the issue's Problem section described a
  cross-entity duplication *bug* that applying the fix narrowly would have actively
  reintroduced), there's no equivalent forcing argument here: leaving events untagged
  doesn't reintroduce or worsen anything, it just doesn't build a feature nobody asked
  for yet.
- Events have no free-text organizational need called out anywhere in `README.md` (they're
  described as "just a reminder, not something to complete") — there's no stated user
  need "tell events apart" the way tasks explicitly have one.

So: `TaskService`/`tasksRouter` gain the write side (`tags` on create/update); `EventService`/
`eventsRouter` are **not touched at all** in this ticket. The one thing kept
entity-agnostic on purpose is the *read* side — `tagsRouter.list` returns every `Tag` row
in the table, not filtered to "tags currently used by a task" — because a `Tag` row
itself has no `kind`, and "expose the Tag relation via tRPC" (the issue's literal first
clause) reads as exposing the `Tag` table's own read model, not a task-scoped view of it.
If a future ticket adds event tagging, `tagsRouter.list` needs no change at all; only
`EventService`/`eventsRouter`/`event-schema.ts` would need the same treatment
`task-schema.ts`/`TaskService`/`tasksRouter` get here. Flagged in §6 as the most
contestable call in this plan, same as `shared-zod-schemas` flagged its opposite call.

### 2.2 "Create/assign/remove" is implemented as one full-array sync on `tasks.create`/`tasks.update`, not three separate procedures

The issue's three verbs read most naturally as three *user-facing capabilities*, not
three necessarily-separate wire procedures. Three concrete reasons this plan collapses
them into `tags: string[]` fields on the existing `create`/`update` inputs instead of
adding `tags.assign`/`tags.remove`/`tags.create` mutations:

- **`TagInput`'s own contract is already "full next array," not deltas.** Per
  `tickets/tag-input-badge/plan.md` §3.2, `TagInput`'s `onChange` always fires with the
  complete next `value: string[]` (after an add or a remove) — never an "added X" or
  "removed Y" event. Building delta-based `assign`/`remove` endpoints would require the
  UI layer to diff the before/after arrays itself just to call the right endpoint(s),
  work that buys nothing since the UI already has the full next state in hand.
- **Tag *creation* has no independent existence in this data model.** Per
  `AGENT_RULES.md`, tags are "a many-to-many relation on that entity, not separate
  collections" — there's no page or concept in this app for "browse/manage all tags"
  independent of a task. A tag is created *by being assigned* (this is also what
  `tickets/tag-input-badge/plan.md` §2.3 predicted: "tags are implicitly created on
  assignment, not chosen from a pre-approved list"). So "create" doesn't need its own
  endpoint — it happens as a side effect of `resolveConnections` (§2.3) the first time a
  name is used.
- **A full-sync `update` is simpler to reason about and test than incremental
  mutations**, and matches how every other field on `tasks.update` already works
  (`title`, `notes`, `dueDate` are all "send the new value" fields, not "send a delta").

Concretely: `taskCreateInput`/`taskUpdateFields` (`task-schema.ts`) both gain
`tags: z.array(z.string().trim().min(1)).optional()`. On `create`, tags (if any) are
connected. On `update`, `tags: undefined` (field omitted) means "leave existing tags
untouched" (same convention as every other optional `update` field); `tags: []`
explicitly clears all of a task's tags (this is real, reachable behavior — removing the
last tag from a task in the UI sends `tags: []`, not an omitted field, since the edit
form always has an opinion about the task's tags once it's open — see §2.4).

### 2.3 Case-insensitive resolution against existing tags, case-preserving storage — the collation decision `tag-input-badge` deferred here

`Tag.name` is `@unique` in `schema.prisma`, and SQLite's default text comparison for that
constraint is exact/case-sensitive (confirmed by reading `schema.prisma` — no
`@db.Collation` or similar; not changing this, see below). Three options:

- **A. Do nothing extra — let `connectOrCreate` on `{ where: { name: rawInput } }` hit
  the exact-match unique constraint as-is.** Rejected: typing "Work" on one task and
  "work" on another would silently create two distinct `Tag` rows for what a user
  clearly intends as the same tag, and both would then show up as separate, confusingly
  near-duplicate entries in the `tags.list` autocomplete suggestions forever. This
  directly undermines "tags distinguish tasks from each other" (the issue's own stated
  purpose) by letting the tag vocabulary silently fragment.
- **B. Change `Tag.name`'s DB-level collation to case-insensitive.** Rejected as
  out-of-scope schema surgery: SQLite's `COLLATE NOCASE` is SQLite-specific syntax
  Prisma's schema DSL doesn't model as a portable feature, and `AGENT_RULES.md`
  explicitly asks to avoid relying on SQLite-specific behavior to keep the future
  Postgres migration a one-line datasource change — a collation change would need
  revisiting at that migration anyway. Not worth it for this ticket.
- **C. (Adopted) Resolve names in the service layer**: `TagService.resolveConnections`
  fetches all existing tags, matches each input name against them
  case-insensitively, reuses the existing tag's `id` (and its already-stored casing) on
  a match, and creates a new `Tag` (preserving the *input's* casing) when there's no
  match. This mirrors `TagInput`'s own client-side case-insensitive dedup (§3.2 of the
  `tag-input-badge` plan) one level up, at the cross-task level the client can't see.
  De-duplicates the input array itself the same way (`["Work", "work"]` on one
  `create` call resolves to a single connection, keeping `"Work"`'s casing since it
  appeared first).

**Known, accepted limitation, not fixed here:** two *concurrent* requests both
first-creating the exact same new tag name could both miss each other's write in the
`findMany` read and then race on the `Tag.name` unique constraint, causing one of the two
`db.tag.create` calls to throw (Prisma error code `P2002`). This is not handled (no
retry, no transaction) — see §5 for why, given this is a personal, single-user local
tool per `README.md`, this is an accepted, low-probability edge case, not a gap.

### 2.4 Where `suggestions` comes from: fetched once in `TasksPage`, not independently by `TaskCreateForm`/`TaskListItem`

`TagInput`'s `suggestions?: string[]` (§2.3 of `tag-input-badge`'s plan) needs a live tag
list from somewhere now that `tags.list` exists. Two options:

- **A. Each of `TaskCreateForm` and every `TaskListItem` instance runs its own
  `useQuery(trpc.tags.list.queryOptions())`.** Would work functionally (TanStack Query
  dedupes identical query keys into one shared cache entry/network call regardless of
  how many components request it), but has a real, avoidable cost for *this ticket's
  tests*: `apps/web/src/routes/tasks-page.tsx` renders one `TaskCreateForm` plus N
  `TaskListItem`s, and `@trpc/client`'s `httpBatchLink` batches every query fired in the
  same tick into a single HTTP request whose URL path is the batched procedures joined
  by commas (confirmed by reading `@trpc/client`'s `httpBatchLink`/`httpUtils` source:
  `path = batchOps.map(op => op.path).join(",")`). Adding an independent `tags.list`
  query to `TaskCreateForm` and to *every* `TaskListItem` would turn every existing
  fetch-mock in `task-create-form.test.tsx` and `task-list-item.test.tsx` (currently
  single-procedure, single-result mocks) into multi-procedure batch-aware mocks too —
  three test files needing new batch-parsing infrastructure instead of one.
- **B. (Adopted) `TasksPage` fetches `tags.list` once and passes the resulting
  `string[]` of names down as a `tagSuggestions` prop** to `TaskCreateForm` and each
  `TaskListItem`. Neither component runs its own tRPC query for this. This is a
  reasonable, if slightly non-uniform, extension of "the feature page owns
  data-fetching, primitives stay generic" (already established for `TagInput` itself in
  `tag-input-badge`'s plan §2.3) one level up: `TasksPage` is the actual feature page;
  `TaskCreateForm`/`TaskListItem` are feature *sub-components* it composes, and the
  all-tags suggestion list is genuinely page-scoped shared data (not per-row state), so
  lifting it removes both the duplicate-query-registration noise and — the concrete
  payoff — confines the "second concurrent query in the same batch" test complexity to
  exactly one file, `tasks-page.test.tsx` (§3.4).

Trade-off acknowledged: `TaskListItem` already independently owns its own
mutations (`toggleComplete`/`update`/`delete` each call `useMutation` directly), so
there's an argument for symmetry — a component that already talks to tRPC directly for
writes could reasonably also own its own read. This plan prioritizes the concrete test-
complexity payoff over that symmetry argument; flagged in §6 as a reversible call (if
`plan-refiner` prefers symmetry, switching `TaskListItem` to its own `useQuery` is a
small, contained change — the batch-mock infrastructure it would require is described
precisely enough in §3.4 to redo there instead).

## 3. Task breakdown

### 3.1 `apps/server/src/services/tag-service.ts` (new)

```ts
import type { PrismaClient } from "@prisma/client";

export class TagService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.tag.findMany({ orderBy: { name: "asc" } });
  }

  // Resolves already-validated (trimmed, non-empty per task-schema.ts) tag names into
  // { id } connect-refs for an Entry.tags write. Case-insensitively matches existing
  // tags (reusing the existing row's id/casing); unmatched names are created fresh,
  // preserving the caller's casing. De-dupes the input list the same way. See
  // tickets/tags/plan.md §2.3 for the reasoning and the known concurrent-create limitation.
  async resolveConnections(names: string[]): Promise<{ id: string }[]> {
    const deduped: string[] = [];
    for (const name of names) {
      if (!deduped.some((d) => d.toLowerCase() === name.toLowerCase())) deduped.push(name);
    }
    if (deduped.length === 0) return [];

    const existing = await this.db.tag.findMany();
    const connections: { id: string }[] = [];
    for (const name of deduped) {
      const match = existing.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (match) {
        connections.push({ id: match.id });
      } else {
        const created = await this.db.tag.create({ data: { name } });
        connections.push({ id: created.id });
        existing.push(created); // later names in this same call see it too
      }
    }
    return connections;
  }
}
```

Not optimized for bulk (N+1 `db.tag.create` calls in the loop, no `$transaction`) —
deliberate, see §5.

### 3.2 `apps/server/src/services/task-schema.ts` (modified)

Add to both `taskCreateInput` and `taskUpdateFields`:

```ts
tags: z.array(z.string().trim().min(1)).optional(),
```

`TaskCreateInput`/`TaskUpdateInput` (the `z.infer` types) pick this up automatically — no
other change needed in this file.

### 3.3 `apps/server/src/services/task-service.ts` (modified)

- Constructor gains a second, defaulted param:
  `constructor(private readonly db: PrismaClient, private readonly tagService: TagService = new TagService(db))`
  — matches this codebase's plain-constructor-injection style, defaults to a real
  `TagService` for routers (which always call `new TaskService(db)`), and lets tests
  inject a fake `TagService` instead of a fake `db.tag` (§4).
- `list()`: add `include: { tags: true }` to the existing `findMany` call. (The existing
  test asserts via `expect.objectContaining`, so this is additive and doesn't need the
  test to change — see §4.)
- `create(input)`: resolve tags (only when `input.tags` is present and non-empty — avoid
  calling `resolveConnections` at all otherwise, both to skip the extra DB round-trip
  and to keep existing no-tags test calls from needing any `db.tag` mock), then add
  `tags: tagConnections.length > 0 ? { connect: tagConnections } : undefined` to `data`.
  **Deliberately not adding `include: { tags: true }` here** — nothing in the current UI
  consumes the mutation's return value beyond invalidating the list query afterward
  (§3.7/§3.8), and adding `include` would change the shape of every existing
  exact-object-literal `db.entry.create` assertion in `task-service.test.ts` in a way
  that isn't tolerated by `toEqual`'s "ignore `undefined`-valued keys" behavior the way
  the new `tags: undefined` key already is (an `include` key with a real value is a
  genuine shape change, not a no-op key) — see §4's note on why this matters.
- `update(id, input)`: same tag-resolution pattern, but `input.tags === undefined` means
  "don't touch tags at all" (`tags: undefined` in the write, distinguished from
  `input.tags` being an empty array, which resolves to `tags: { set: [] }` — explicitly
  clearing every tag). Same "no `include` here" reasoning as `create`.

### 3.4 `apps/server/src/routers/tags-router.ts` (new)

```ts
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { TagService } from "../services/tag-service";

export const tagsRouter = router({
  list: publicProcedure.query(() => new TagService(db).list()),
});
```

### 3.5 `apps/server/src/routers/app-router.ts` (modified)

Add `tags: tagsRouter` (imported from `./tags-router`) alongside `tasks`/`events`.
`eventsRouter`/`event-router.ts`/`event-schema.ts`/`event-service.ts` are **not touched**
(§2.1).

### 3.6 `apps/server/prisma/seed.ts` (modified, small)

Attach one or two tags to the seeded tasks so the feature is visibly exercisable via
`npm run migrate -w apps/server && npm run dev` without manually typing tags first —
directly supports manually verifying "show tags in the task list UI." Requires switching
from `db.entry.createMany` (doesn't support nested relation writes) to sequential
`db.entry.create({ data: { ..., tags: { create: [{ name: "..." }] } } })` calls. Small,
not blocking — a reasonable, low-effort inclusion rather than a deferred nice-to-have,
since it's the fastest way to manually confirm the whole feature end-to-end.

### 3.7 `apps/web/src/routes/tasks-page.tsx` (modified)

- Add a second query: `useQuery(trpc.tags.list.queryOptions())`.
- Derive `tagSuggestions = (tagsData ?? []).map((t) => t.name)`.
- Pass `tagSuggestions` to `<TaskCreateForm tagSuggestions={tagSuggestions} />` and to
  each `<TaskListItem key={task.id} task={task} tagSuggestions={tagSuggestions} />`.
- The existing `isLoading`/`isError` states stay keyed off `tasks.list` only (not
  `tags.list`) — a slow/failed tag-suggestions fetch shouldn't block or error out the
  whole task list; `TagInput` degrades gracefully with an empty/stale `suggestions` array
  either way (per `tag-input-badge`'s plan §2.3, freeform entry works with no
  suggestions at all).

### 3.8 `apps/web/src/routes/task-create-form.tsx` (modified)

- New prop: `tagSuggestions?: string[]` (default `[]` if omitted, so the component still
  renders standalone in isolation/tests without a `TasksPage` parent).
- New local state: `const [tags, setTags] = useState<string[]>([]);`.
- Render `<TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />`
  (default `label`/`placeholder`, i.e. `aria-label="Tags"`) below the notes `Textarea`,
  above the submit `Button`.
- `handleSubmit`: include `tags: tags.length > 0 ? tags : undefined` in the mutation
  payload (mirrors the existing `notes: notes.trim() || undefined` "omit when empty"
  convention for optional create fields).
- `onSuccess`: reset `tags` to `[]` alongside the existing `title`/`dueDateValue`/`notes`
  resets.

### 3.9 `apps/web/src/routes/task-list-item.tsx` (modified)

- New prop: `tagSuggestions?: string[]` (default `[]`).
- New local state: `const [editTags, setEditTags] = useState<string[]>(task.tags?.map((t) => t.name) ?? []);`
  — note `task.tags` needs the same defensive `?? []` this file already applies to
  `task.completed` (partial/legacy fixture tolerance, §4).
- `handleEditClick`: also resets `editTags` from `task.tags?.map((t) => t.name) ?? []`
  (mirrors the existing `editTitle`/`editNotes` reset).
- Editing view: render `<TagInput value={editTags} onChange={setEditTags} suggestions={tagSuggestions} label="Edit task tags" />`
  below the notes `Textarea`. `TagInput` renders its own removable chips internally, so
  no separate read-only tag row is needed in the editing view.
- `handleSave`: always include `tags: editTags` in the `update` mutation payload
  (unlike `notes`, there's no "leave untouched" case here once the edit form is open —
  see §2.2 for why an explicit `tags: []` is real, reachable "clear all tags" behavior,
  not an accidental omission).
- Non-editing (read) view: render each tag as a `Badge` when `task.tags` is non-empty:
  `{(task.tags ?? []).length > 0 && <div className="flex flex-wrap gap-2">{(task.tags ?? []).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>}`,
  placed alongside the existing conditional `dueDate`/`notes` lines. Tags are **not**
  independently removable from this read view — removal only happens via
  Edit → `TagInput` → Save, same interaction model as every other editable field on this
  component (no new UX paradigm introduced).

### 3.10 Files touched/created (summary)

New:
- `apps/server/src/services/tag-service.ts`, `tag-service.test.ts`
- `apps/server/src/routers/tags-router.ts`, `tags-router.test.ts`

Modified:
- `apps/server/src/services/task-schema.ts`, `task-service.ts`, `task-service.test.ts`
- `apps/server/src/routers/task-router.test.ts` (validation/pass-through tests for the
  new `tags` field — `task-router.ts` itself needs **no** change, since it already does
  `.input(taskCreateInput)` / `.input(idInput.merge(taskUpdateFields))` and both schemas
  now include `tags`)
- `apps/server/src/routers/app-router.ts`
- `apps/server/prisma/seed.ts`
- `apps/web/src/routes/tasks-page.tsx`, `tasks-page.test.tsx`
- `apps/web/src/routes/task-create-form.tsx`, `task-create-form.test.tsx`
- `apps/web/src/routes/task-list-item.tsx`, `task-list-item.test.tsx`

Not touched: `schema.prisma` (no migration needed, §1), `apps/server/src/services/event-*`,
`apps/server/src/routers/event-router.ts` (§2.1), `apps/web/src/components/ui/tag-input.tsx`/
`badge.tsx`/`ui-demo-page.tsx` (already complete from `tag-input-badge`; that ticket's
demo page already registers both components), `apps/web/src/trpc.ts` (the `Task` type is
fully inferred from `AppRouter`, so it automatically gains `tags: { id: string; name: string }[]`
once `TaskService.list()`'s query changes — no manual type edit needed, consistent with
`AGENT_RULES.md`'s "never hand-write a manual type for API responses").

## 4. Edge cases and error conditions (for reviewer-tests)

**`TagService` (`tag-service.test.ts`, new):**
- `list()` returns `[]` when there are no tags; returns whatever `db.tag.findMany`
  resolves with, ordered by `name` (assert the `orderBy` arg, not client-side sorting).
- `resolveConnections([])` returns `[]` without calling `db.tag.findMany` at all (short-
  circuits before any DB read).
- A name that case-insensitively matches an existing tag resolves to that tag's `id`
  (not a new one) — assert `db.tag.create` is **not** called for that name.
- A name with no match creates a new tag with the *input's* casing preserved (e.g.
  input `"Work"` against existing `["urgent"]` creates `{ name: "Work" }`, not
  `{ name: "work" }`).
- Two case-variant names in the *same* call (`["Work", "work"]`) resolve to a single
  connection, and only one `db.tag.create`/reuse happens — assert the result array has
  length 1.
- A mix of one matching and one new name in the same call resolves both correctly,
  reusing the found tag's `id` for the match and creating only the new one.
- Whitespace/casing edge: matching is on `.toLowerCase()` only (already-trimmed input is
  assumed per §3.2 — this service doesn't re-trim, matching this codebase's existing
  convention that routers own trimming and services trust it, per `task-service.test.ts`'s
  own comment "trimming happens upstream in the router's Zod schema").
- **Not tested here** (see §5): the concurrent-create race (§2.3) — no retry/transaction
  logic exists to exercise.

**`TaskService` (`task-service.test.ts`, modified — inject a fake `TagService`, don't
extend `createFakeDb`'s `db.tag` mocking, per §3.3's DI reasoning):**
- `create` with `tags` omitted: `tagService.resolveConnections` is **not** called at all
  (assert `expect(fakeTagService.resolveConnections).not.toHaveBeenCalled()`), and
  `db.entry.create`'s `data` has no non-`undefined` `tags` key — this is also what keeps
  every *existing* `create`/`update` test in this file passing without modification,
  since none of them pass `tags` (see §3.3's note on `toEqual`'s undefined-key
  tolerance — worth a comment in the test file, not just relying on it silently).
- `create` with `tags: ["urgent"]`: `resolveConnections` is called with `["urgent"]`, and
  its resolved `[{ id }]` result is passed through as `data.tags.connect`.
- `create` with `tags: []` (explicit empty array, distinct from omitted): resolves to no
  `tags` write at all — same as omitted (an empty array has nothing to connect either
  way; the omitted-vs-`[]` distinction only matters on `update`, where `[]` means
  "clear," see next bullet).
- `update` with `tags` omitted: `resolveConnections` not called; `data.tags` is
  `undefined` (existing associations untouched).
- `update` with `tags: []`: `resolveConnections` **is** called (with `[]`, resolving to
  `[]`), and `data.tags` is `{ set: [] }` — explicitly clears all tags. This is the one
  case where "called with an empty array" and "not called at all" must be told apart in
  the test, since they produce different Prisma writes.
- `update` with `tags: ["urgent", "home"]`: `data.tags` is `{ set: [...resolved ids] }`.
- `list()` includes `include: { tags: true }` in the `findMany` call (assert via
  `expect.objectContaining`, alongside the existing `where`/`orderBy` assertions).

**`tasksRouter` (`task-router.test.ts`, modified — extend the `vi.mock("../db", ...)`
mock to add `tag: { findMany: tagFindMany, create: tagCreate }` alongside the existing
`entry: {...}` mock, since the router constructs a real `TagService` internally, not an
injectable one):**
- `create`/`update` reject an empty-string entry inside `tags` (e.g. `tags: [""]`) —
  `BAD_REQUEST`, `entry.create`/`entry.update` and `tag.create`/`tag.findMany` all **not**
  called (schema validation fails before the service is ever reached).
- `create`/`update` reject a non-array `tags` value (e.g. `tags: "urgent"`) — same as
  above.
- `create` with a valid `tags` array end-to-end: `tagFindMany` resolves `[]`, `tagCreate`
  resolves the created row, and `entry.create`'s `data.tags` ends up `{ connect: [...] }`
  with the id `tagCreate` returned.
- `update` with `tags: []` end-to-end (needs `findUnique` mocked so `assertTaskExists`
  passes): `entry.update`'s `data.tags` is `{ set: [] }`.
- Existing malformed-`dueDate`/empty-`title`/`notes`-null/etc. tests in this file
  continue to pass unmodified — the new mock keys are additive.

**`tagsRouter` (`tags-router.test.ts`, new, matching `event-router.test.ts`'s
`vi.mock("../db", ...)` + `createCaller` pattern):**
- `tags.list` wires through to `TagService.list()` via `createCaller` — resolves
  whatever `db.tag.findMany` resolves with, calls it with `{ orderBy: { name: "asc" } }`.
- `tags.list` with no rows in the DB resolves `[]`.

**Web — `TasksPage` (`tasks-page.test.tsx`, modified):** every existing test that
provides a real (non-pending, non-rejecting) `fetchImpl` needs its mock upgraded from a
single-procedure response to a batch-aware one, since `tags.list` is now a second query
fired alongside `tasks.list` in the same render (§2.4). Concretely: replace the existing
single-item `jsonResponse([{ result: { data } }])` helper usage with one that parses the
request URL's comma-joined procedure-path segment (`.../trpc/tasks.list,tags.list?...`)
and returns a same-order array of `{ result: { data: byPath[procName] } }`, keyed by a
caller-supplied `{ "tasks.list": [...], "tags.list": [...] }` map — this can be a small
local helper in this file alone (only this file needs multi-procedure batching, per
§2.4's design). Specific cases:
- The "loading" test (never-resolving `fetchImpl`) is unaffected — it doesn't inspect
  the response shape at all.
- The "error" test (`Promise.reject(...)`) is unaffected for the same reason.
- The populated-list test's mock needs both `"tasks.list"` (existing row fixture,
  **with a `tags: []` key added** — see the `TaskListItem` fixture note below) and
  `"tags.list"` (e.g. `[{ id: "t1", name: "urgent" }]`) supplied.
- New test: a task row with `tags: [{ id: "t1", name: "urgent" }]` renders an "urgent"
  badge in the list.
- New test (optional but cheap): typing into the create form's tag input after
  `tags.list` resolves offers the fetched tag name as a suggestion — proves the
  suggestions prop actually threads through `TasksPage → TaskCreateForm`, not just that
  the page compiles.

**Web — `TaskCreateForm` (`task-create-form.test.tsx`, modified) — no query-mocking
changes needed (§2.4), just new prop-driven tests:**
- Adding a tag via the `TagInput` (type + Enter) and submitting includes `tags: [...]`
  in the create mutation payload.
- Submitting with no tags added omits `tags` from the payload entirely (matches the
  existing `notes`-omission convention, tested the same way as the existing "omits notes
  from the mutation payload when empty" test).
- `onSuccess` clears the tag chips (assert no `Remove <tag>` button remains after a
  successful submit that included tags) alongside the existing title/dueDate/notes reset
  assertions.
- Passing `tagSuggestions={["urgent", "home"]}` and typing a matching prefix surfaces
  that suggestion in the listbox (thin integration check that the prop reaches
  `TagInput` correctly — full autocomplete behavior itself is already covered by
  `tag-input.test.tsx` and isn't re-tested here).
- Omitting `tagSuggestions` entirely still renders and lets a tag be added via freeform
  Enter (component doesn't require the prop).

**Web — `TaskListItem` (`task-list-item.test.tsx`, modified):**
- `makeTask()`'s default fixture gains `tags: []`, matching the real shape
  `TaskService.list()` now returns. A **new**, separate test keeps the existing
  "defaults to unchecked when `completed` is undefined on a partial fixture" pattern for
  `tags`: delete `tags` from a fixture and assert the read view renders with no tag
  badges and doesn't throw (defensive `task.tags ?? []`).
- Non-editing view renders a `Badge` per tag when `task.tags` is non-empty (assert tag
  text is reachable via `getByText`).
- Non-editing view renders no tag section when `task.tags` is `[]`.
- Clicking Edit pre-fills the `TagInput` with the task's current tags as removable chips
  (assert `Remove <tag>`-labeled buttons for each).
- Clicking Edit on a task with no tags shows an empty `TagInput` (no chips).
- In edit mode, adding a tag then Save includes the full updated tag array (existing +
  new) in the `update` mutation payload.
- In edit mode, removing a tag (its chip's `×` button) then Save includes the remaining
  tags (not the removed one) in the `update` mutation payload.
- In edit mode, removing the *only* tag then Save sends `tags: []` explicitly (not an
  omitted field) — this is the concrete UI path that exercises the `update`
  omitted-vs-`[]` distinction from `task-service.test.ts`/`task-router.test.ts` above.
- Cancel after adding/removing a tag in edit mode discards the change without calling
  `update`, and the read view still shows the original tags (mirrors the existing
  title/notes Cancel tests).
- Save with no tag changes at all still includes `tags: [...]` (the unchanged array) in
  the payload — confirms `TaskListItem` always sends the current `editTags` state on
  Save, per §3.9's "no untouched case once the edit form is open" design.

**Not planned as a dedicated test (documented so `reviewer-tests` doesn't expect it):**
- The concurrent-identical-tag-creation race (§2.3, §5) — no code path exists to test.
- Any assertion about `Tag` row garbage collection after a task's last tag is removed or
  the task itself is deleted — no such behavior is implemented (§5); orphaned `Tag` rows
  persisting is expected, not a bug to catch.
- Event-side tag behavior — `EventService`/`eventsRouter` are untouched (§2.1).
- Anything about `Badge`'s or `TagInput`'s own internal rendering/interaction beyond
  "the props threading through this ticket's new call sites work" — both components'
  own full behavior is already covered by `badge.test.tsx`/`tag-input.test.tsx` from
  `tag-input-badge` and isn't re-derived here.

## 5. Explicitly not doing (scope boundaries)

- **Event tagging.** `EventService`/`eventsRouter`/`event-schema.ts` untouched — §2.1's
  reasoned call, not an oversight.
- **A tag-deletion or tag-rename endpoint**, and any garbage collection of `Tag` rows
  that end up with zero attached entries (e.g. after the last task using a tag removes
  it, or that task is deleted). The issue only asks for create/assign/remove *on a
  task*, which this plan reads as "manage a task's tag associations," not "manage the
  global tag vocabulary." Orphaned tags simply keep appearing in `tags.list`
  suggestions — arguably even useful (a tag a user has used before stays offered for
  reuse even if not currently on any task). A future ticket can add cleanup or an
  explicit tag-management page if that turns out to matter.
- **Retry/transaction hardening for the concurrent-identical-tag-creation race (§2.3).**
  Accepted as a low-probability edge case given this is a personal, single-user local
  tool (`README.md`) — not a multi-tenant service where concurrent writes to the same
  tag name are a realistic, frequent scenario.
- **A DB-level case-insensitive collation change on `Tag.name`.** Handled in the service
  layer instead (§2.3), specifically to avoid a SQLite-specific schema feature that
  would complicate the documented Postgres migration path.
- **Tag-based filtering, grouping, or a dedicated "browse by tag" view.** That's task
  list view (#8) territory — this ticket only shows each task's own tags inline, it
  doesn't add any new way to slice the list by tag.
- **Max tag count per task, max tag name length, or any other tag-specific form
  validation.** Not requested by the issue; matches the same "validation/error-state
  styling is a future feature-ticket concern" boundary `tag-input-badge`'s plan already
  drew for `TagInput` itself.
- **Any change to `apps/web/src/components/ui/tag-input.tsx`, `badge.tsx`, or
  `ui-demo-page.tsx`.** All three are complete and already registered from the
  `tag-input-badge` ticket; this ticket is pure consumer wiring.
- **Any Prisma schema or migration change.** `Tag` and the join table already exist
  (§1).
- **Pagination or a result-count limit on `tags.list`.** Personal-scale tag vocabulary;
  not a realistic concern yet.

## 6. Open questions

Contestable calls this plan resolved with reasoning rather than leaving open, flagged
for visibility (most contestable first):

1. **Task-only scope, not event-generic (§2.1).** The opposite call from
   `shared-zod-schemas`'s "extend to event too" — reasoned from `README.md`'s MVP scope
   list explicitly saying "Tags on tasks" (not entries generically) and from there being
   no forcing argument (no duplication-that-undermines-the-point risk) the way
   `shared-zod-schemas` had. If the human intended tags to apply to events too, the
   contained fix is: add the same `tags` field to `event-schema.ts`/`EventService`/
   `event-router.ts`, reusing the same `TagService` (already entity-agnostic) — not a
   redesign.
2. **`suggestions` fetched once in `TasksPage` and threaded down via props, rather than
   `TaskCreateForm`/`TaskListItem` each running their own `tags.list` query (§2.4).**
   Trades a small symmetry inconsistency (`TaskListItem` owns its mutations directly but
   not this one read) for materially simpler tests. Reversible — §2.4/§4 describe
   exactly what the batch-aware mock would need if `plan-refiner` prefers the
   query-per-component symmetry instead.
3. **Case-insensitive resolution, case-preserving storage, no DB collation change
   (§2.3).** Resolves the collation question `tag-input-badge`'s plan explicitly left
   open for "whichever future ticket wires this up" — this is that ticket. The known,
   accepted gap is the concurrent-identical-create race (§5), not the collation
   approach itself.
4. **`tags: []` on `update` explicitly clears all tags, distinct from an omitted `tags`
   field leaving them untouched (§2.2).** This asymmetry (present-but-empty vs. absent)
   is the same shape as the existing `notes: null` vs. `notes` omitted distinction
   already established for `update` — not a new pattern, just tags' version of it.
5. **No dedicated "create tag" or "manage tags" endpoint/page (§2.2, §5).** Tags are
   created only as a side effect of being assigned to a task. If a future ticket wants a
   standalone tag-management surface, `TagService` already has the one method
   (`resolveConnections`) that would need to grow, not a rewrite.

None of these are blocking — each has a stated default and reasoning above.
