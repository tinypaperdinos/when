# Plan: Notes on tasks (issue #5)

Issue #5's full text (fetched via `gh issue view 5`):

> Add a notes field to the Entry model (likely a plain text/markdown field) plus a
> procedure and UI to edit it. Small scope, kept as its own ticket for a reviewable diff.
>
> Depends on: Task CRUD (#4) — needs create/update procedures to attach notes-editing to.
>
> Comment (SamuelEffler): Also depends on the component library (#14 setup, #15 form
> primitives) — its notes-editing UI should use the shared `Textarea` component rather
> than ad-hoc markup.

Both dependencies are merged into `main` (Task CRUD: PR #31; component library: `Textarea`
already exists at `apps/web/src/components/ui/textarea.tsx`, demoed at
`ui-demo-page.tsx`). This plan builds directly on that code.

## 1. What "done" means

- **No schema/migration change is needed.** `Entry.notes String?` already exists in
  `apps/server/prisma/schema.prisma` and in the initial migration
  (`20260725111646_init/migration.sql`) — it was added during scaffolding (#3) in
  anticipation of this ticket, but has never been read from or written to by any
  procedure. `tickets/task-crud/plan.md` explicitly deferred wiring it up: *"a
  `notes`/Notes-editor UI (explicitly deferred to issue #5...)"*. This ticket is the one
  that actually wires it up — pure service/router/UI work, like Task CRUD was.
- `TaskService.create` and `TaskService.update` (`apps/server/src/services/task-service.ts`)
  accept and persist an optional `notes` field, alongside the existing `title`/`dueDate`
  handling. `tasksRouter`'s `create`/`update` Zod input schemas
  (`apps/server/src/routers/task-router.ts`) gain a validated `notes` field.
- `TaskCreateForm` (`apps/web/src/routes/task-create-form.tsx`) gains a `Textarea` for
  notes, submitted alongside the title on create.
- `TaskListItem`'s edit mode (`apps/web/src/routes/task-list-item.tsx`) gains a `Textarea`
  for notes, submitted alongside the title on save. The non-editing view also renders the
  task's notes when present (see §3.4 — without this, there's no way to confirm via the UI
  that a save actually took effect).
- Both forms use the existing `Textarea` component (`apps/web/src/components/ui/
  textarea.tsx`) — no new `ui/` primitive, per the issue's own comment.
- CI (`lint`, `typecheck`, `test`, `build`) stays green.

**Resolved ambiguity — "plain text/markdown field":** the issue hedges with "likely a
plain text/markdown field." No markdown-parsing/rendering library is in the stack
(`AGENT_RULES.md` doesn't mention one), and `Textarea`'s own demo
(`ui-demo-page.tsx:153`, `placeholder="Notes…"`) already establishes it as a plain
multi-line text control. This ticket treats `notes` as plain text: stored and displayed
verbatim (with line breaks preserved via CSS, not Markdown-rendered). Flagging this here
rather than silently picking it — if Markdown rendering is actually wanted, that's a
follow-up ticket (a rendering library is a bigger addition than this ticket's "small
scope, reviewable diff" framing allows).

## 2. Task breakdown

### 2.1 `apps/server/src/routers/task-router.ts`

- `createInput` gains `notes: z.string().trim().optional()` — same optionality shape as
  `dueDate` on create (omit entirely = no notes).
- `updateInput` gains `notes: z.string().trim().nullable().optional()` — same
  three-state shape as `dueDate` on update (`undefined` = leave untouched, `null` =
  explicitly clear, string = set).
- No `.min()`/`.max()` constraint on `notes` — mirrors `title`, which also has no max, and
  the issue doesn't ask for one. Called out as a deliberate omission in §4.
- No router-level change beyond the schemas — `create`/`update` procedures already spread
  `input` into the service call (`update` already does `const { id, ...rest } = input`),
  so `notes` flows through automatically once it's a validated field on the input schema.

### 2.2 `apps/server/src/services/task-service.ts`

- `create(input: { title: string; dueDate?: string; notes?: string })`: add
  `notes: input.notes ? input.notes : undefined` to the `data` object. Business rule
  (belongs in the service per `AGENT_RULES.md`, not the Zod schema): a notes value that's
  empty after trimming (i.e. the user typed only whitespace) is treated the same as no
  notes at all — stored as `undefined`, which Prisma persists as `null` (same "undefined
  on create → null in the db" behavior `dueDate` already has, per the existing
  `task-service.test.ts` comment on that).
- `update(id, input: { title?: string; dueDate?: string | null; notes?: string | null })`:
  add `notes: input.notes === undefined ? undefined : (input.notes || null)` to the `data`
  object — `undefined` leaves the column alone, an explicit `null` or an
  empty/whitespace-only string both clear it to `null`, any other string sets it.
- `assertTaskExists` is unchanged — no new logic needed there.

### 2.3 `apps/web/src/routes/task-create-form.tsx`

- New `notes` state (`useState("")`), rendered as `<Textarea aria-label="Task notes"
  placeholder="Notes…" value={notes} onChange={...} />`, placed after the
  `DateTimePicker`.
- On submit: include `notes: notes.trim() || undefined` in the `create` mutation payload
  (mirrors `dueDatePayload`'s omit-when-empty behavior, and matches the create schema's
  `.optional()` — not `.nullable()`, since there's never an existing value to clear on a
  brand-new task).
- On success: reset `notes` to `""` alongside the existing `title`/`dueDateValue` resets.
- On error: leave `notes` as typed (matches existing title-preserved-on-error behavior —
  no extra code needed, it's just "don't reset on error," which the component already
  does implicitly by only resetting in `onSuccess`).

### 2.4 `apps/web/src/routes/task-list-item.tsx`

- New `editNotes` state, initialized like `editTitle`: `useState(task.notes ?? "")` at
  declaration, and reset to `task.notes ?? ""` in `handleEditClick`.
- Edit-mode JSX gains a `<Textarea aria-label="Edit task notes" value={editNotes}
  onChange={...} />` below the title `TextInput`.
- `handleSave` sends `notes: editNotes.trim() || null` in the `update` mutation payload
  (always sent, same as `title` is always sent today, regardless of whether it changed —
  matches the existing "no dirty-tracking" style of this component). Empty/whitespace
  clears notes, matching the service-level rule in §2.2.
- Non-editing view: render `task.notes` when present, e.g.
  `{task.notes && <p className="whitespace-pre-wrap">{task.notes}</p>}` near the existing
  conditional `{task.dueDate && <p>Due ...</p>}` line. `whitespace-pre-wrap` is needed
  because a `<p>` collapses the newlines a multi-line `Textarea` value contains by
  default — without it, multi-line notes would visually render as one line despite being
  stored correctly.

### 2.5 No changes needed

- `apps/web/src/trpc.ts`'s `Task` type is inferred from `AppRouter`/Prisma's `Entry`
  shape, which already includes `notes` (confirmed: `task-list-item.test.tsx`'s `makeTask`
  fixture already sets `notes: null`) — no manual type edits.
- No new migration, no `apps/server/prisma/schema.prisma` edit.
- `TasksPage` (`apps/web/src/routes/tasks-page.tsx`) needs no changes — it just renders
  `TaskCreateForm` and `TaskListItem`s, both of which absorb the new field internally.

## 3. Edge cases and error conditions

Server (`task-service.test.ts` / `task-router.test.ts`):

- `create` with `notes` provided: persisted unchanged (trimmed by the router).
- `create` with `notes` omitted: `data.notes` is `undefined` (→ `null` in the db), same
  pattern as the existing `dueDate`-omitted test.
- `create` with a whitespace-only `notes` value reaching the service (post-router-trim,
  so effectively `""`): normalized to `undefined`, not stored as an empty string.
- `update` with `notes` omitted: `data.notes` is `undefined` — existing notes untouched.
- `update` with `notes: null`: clears existing notes to `null`.
- `update` with `notes: ""` (post-trim empty string) reaching the service: also clears to
  `null` — same outcome as explicit `null`, per the business rule in §2.2.
- `update` with a real `notes` string: overwrites the existing value.
- `update`/`create` on a non-task (`kind: "event"`) or missing id: existing `NOT_FOUND`
  behavior is untouched — `notes` doesn't bypass `assertTaskExists`.
- Router: a padded/whitespace-wrapped `notes` value is trimmed before reaching the
  service (mirrors the existing title-trimming router test).
- Router: `notes` is never `.min(1)`-required — an empty-string or all-whitespace
  submission must *not* throw (unlike `title`, where the same input is rejected). This
  distinction is worth an explicit test since it's easy to accidentally copy the title
  validator wholesale.

Web (`task-create-form.test.tsx` / `task-list-item.test.tsx`):

- Create form: submitting with notes set includes `notes` in the mutation payload;
  submitting with notes empty/whitespace-only omits the `notes` key entirely (JSON
  round-trip via the existing `fetchImpl` mock pattern, matching how the `dueDate`-omitted
  test already asserts key absence via `toEqual`).
- Create form: notes field resets to `""` on successful submit, alongside title/due date.
- Create form: notes field is preserved (not cleared) when the mutation errors.
- List item: entering edit mode pre-fills the notes textarea with the task's current
  `notes`, including the empty-string case when `task.notes` is `null`.
- List item: Save sends the trimmed notes string, or `null` when the field was cleared to
  empty/whitespace.
- List item: Cancel discards a typed notes change without calling `update` and without
  mutating the read-only view.
- List item: the non-editing view renders notes text when `task.notes` is a non-empty
  string, and renders nothing extra when it's `null` (mirrors the existing due-date
  present/absent test pair).
- List item: an update failure while editing notes leaves the component in edit mode with
  the typed (unsaved) notes value preserved — mirrors the existing title-preserved-on-
  error test.

## 4. Deliberately out of scope

- **Markdown rendering/parsing of notes.** Resolved as plain text — see §1's "Resolved
  ambiguity" note. No rendering library added.
- **Max-length validation on `notes`.** Neither the issue nor the existing `title` field
  has one; adding an arbitrary limit here would be scope creep beyond "small,
  reviewable diff."
- **Dirty-tracking / only sending `notes` on save when it actually changed.** The existing
  `handleSave` already always sends `title` unconditionally regardless of whether it
  changed; `notes` follows the same "always send current field state" style rather than
  introducing per-field dirty-tracking as a one-off for this field.
- **Notes on events.** `Entry.notes` is a shared column, but `eventsRouter` doesn't exist
  yet (events are out of scope of both Task CRUD and this ticket) — nothing to wire up
  there.
- **Rich-text/attachment/file support, tags-in-notes, or any notes-specific formatting
  toolbar.** Not requested by the issue; `Textarea` is a plain multi-line text control by
  design (per `tickets/form-primitives/plan.md`).
- **Autosave / debounced save of notes while typing.** Follows the existing explicit
  Save/Cancel pattern already used for title edits — no new interaction model introduced
  for just this field.
- **A dedicated "notes" collapsed/expanded UI treatment** (e.g. truncating long notes
  with a "show more" toggle) in the non-editing view. Out of scope — notes render in full,
  same as the due-date line does today; if long notes turn out to be a real problem, that's
  its own follow-up ticket, not pre-emptively solved here.
