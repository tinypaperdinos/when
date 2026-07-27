# Refiner notes — notes-on-tasks

## Round 1

**Verification performed:** fetched issue #5 verbatim (`gh issue view 5 --json title,body,comments,...`)
and cross-checked it word-for-word against plan.md's quoted excerpt (matches exactly,
including the dependency comment thread on #4/#14/#15). Independently verified every
"already true in the codebase" claim the plan makes rather than trusting the prose:

- `Entry.notes String?` is present in `apps/server/prisma/schema.prisma` and in
  `20260725111646_init/migration.sql` — confirmed no migration is actually needed.
- `TaskService.create`/`update` and `tasksRouter`'s `createInput`/`updateInput` do not
  currently reference `notes` at all — confirmed the plan isn't redundant with existing work.
- `update`'s router procedure already does `const { id, ...rest } = input` and spreads into
  the service call — confirmed the "no router-level change beyond the schemas" claim holds.
- `Textarea` (`apps/web/src/components/ui/textarea.tsx`) exists and is demoed with
  `placeholder="Notes…"` — confirmed both the component-library dependency and the
  "plain text, not markdown" resolution the plan draws from it.
- `Task` type in `apps/web/src/trpc.ts` is inferred from `AppRouter`'s real query return
  type (not hand-written), and `task-list-item.test.tsx`'s `makeTask` fixture already sets
  `notes: null` — confirmed "no manual type edits needed" is accurate, not just asserted.
- Existing `task-service.test.ts` / `task-create-form.test.tsx` establish the exact
  `undefined`-omitted-key / `toEqual` test idioms the plan says it will reuse — confirmed
  the planned test additions are stylistically consistent with what's already there, not a
  new pattern.
- No `eventsRouter` exists yet — confirmed "notes on events" is correctly out of scope,
  not quietly dropped.

**Findings:**

1. (Non-blocking, worth a one-line flag) The plan adds `notes` to `TaskCreateForm` as well
   as to `TaskListItem`'s edit mode. The issue's text is "plus a procedure and UI to edit
   it" — arguably scoped only to editing an *existing* task's notes, not necessarily
   exposing notes at creation time. The plan doesn't call this out as an interpretation
   choice the way it explicitly does for the markdown-vs-plain-text question in §1; it's
   presented as simply part of the work. That said, the interpretation the plan picked
   (notes settable wherever title/dueDate are settable, i.e. both create and edit) is the
   obviously sensible default given how `title`/`dueDate` already work identically in both
   forms, and reversing it would be a strange, inconsistent UX. I would not block on this,
   but the plan should have named it as a resolved ambiguity alongside the markdown one
   rather than silently folding it into scope.

2. No other under- or over-scoping found. Markdown rendering, max-length validation,
   dirty-tracking, notes-on-events, rich text/attachments, autosave, and
   truncate/show-more UI are all correctly and explicitly deferred in §4 with reasoning
   tied back to the issue text or existing codebase conventions, not just asserted as
   "out of scope."

3. Edge-case coverage (§3) is thorough and specifically calls out the one place a copy-paste
   mistake is likely: notes must NOT get `title`'s `.min(1)` treatment (empty/whitespace is
   valid and must clear rather than reject), and the plan asks for an explicit test on
   exactly that distinction rather than assuming reviewers will catch a missing `.min()`.

4. Business-rule placement (empty-after-trim ⇒ `null`) is correctly located in the service
   per `AGENT_RULES.md`'s "business logic lives in service classes, not procedure
   definitions," and the create/update three-state semantics (`undefined`/`null`/string)
   mirror the existing `dueDate` field's semantics exactly — no new pattern introduced.

5. Risk profile is low: no migration, no schema change, no shared/external state, fully
   reversible, and the diff shape (router schema + service data object + two form
   components) matches how `title`/`dueDate` were wired up in Task CRUD. Nothing vague
   where it should be specific — every file, method signature, and data-flow rule named in
   the plan was checked against the actual current source and matches.

No blocking issues found. Item 1 is a documentation nit (should have been surfaced as a
named ambiguity, like the markdown question was) rather than a scope or correctness
problem — the chosen behavior is the right default.

VERDICT: APPROVED
