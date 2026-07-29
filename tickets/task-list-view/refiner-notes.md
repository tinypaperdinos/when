# Refiner notes: task-list-view

## Round 1

### Verification performed (not just re-reading the plan)

I independently re-derived the plan's three load-bearing factual claims rather than
trusting the plan's own audit, since a plan can be internally consistent and still wrong
about the world it's built against:

1. **Unmerged-dependency audit (§0).** Re-ran the check myself: `git log main --
   apps/web/src/components/ui/modal.tsx` — empty, confirms no `Modal` on `main`.
   `git show main:apps/web/src/components/ui/card.tsx` — confirms `Card` is still the
   original `padding: "sm"|"md"`, `rounded-sm`/`shadow-hard` bordered `div`, not PR #39's
   `rounded-none`/`shadow-float` refactor. Read PR #39's actual diff: it only swaps
   Tailwind classes (corner radius + shadow token), doesn't touch the `padding` prop API
   at all — so even if #39 merges mid-implementation, this plan's `<Card padding="sm">`
   usage stays valid without any follow-up needed. Read PR #40's actual diff: it swaps
   `DateTimePicker`'s internal date input for a hand-rolled `CalendarPopup`, but preserves
   the full public prop surface (`value`/`onChange`/`dateLabel`/`timeLabel`/`addTimeLabel`/
   `minDate`/`disabled`) — so this plan's `DateTimePicker` usage in `task-list-item.tsx`
   also stays API-compatible either way. Both unmerged PRs are correctly identified as
   non-blocking, and I confirmed *why* they're non-blocking (prop-API stability) rather
   than just taking the plan's word for it. One thing worth flagging for whoever
   implements: PR #40 also touched `task-create-form.test.tsx` (likely because
   `fireEvent.change` on a native `<input type=date>` won't drive a `CalendarPopup` the
   same way) — if #40 merges mid-implementation, the new due-date tests in
   `task-list-item.test.tsx` (§3.5) may need the same interaction-pattern follow-up. Not a
   plan defect (the plan already generically flags "adapting to a merged sibling PR is a
   follow-up's concern"), just a concrete heads-up for the implementer.

2. **The null-due-date sort bug and its fix (§3.1).** Verified this is real, not
   theoretical, by running actual queries against this repo's real Prisma client
   (v6.19.3) and a copy of the dev SQLite db:
   - Current `orderBy: { dueDate: "asc" }` (no `nulls` option): a no-due-date task sorted
     **before** a task due 2026-08-01. Confirms the bug as described.
   - `orderBy: { dueDate: { sort: "asc", nulls: "last" } }`: the same two rows sorted
     dated-task-first, null-last. Confirms the fix works.
   - Also confirmed this type-checks cleanly against the repo's actual generated Prisma
     types (`tsc --noEmit -p apps/server/tsconfig.json`) with no `previewFeatures` flag
     needed in `schema.prisma` — `orderByNulls` went GA in Prisma 4.16, well before 6.19.3,
     and works on this repo's SQLite provider (an older/preview-era limitation search
     results surfaced for SQLite does not apply to this Prisma version — worth trusting
     the empirical check over the stale search result here).
   - This claim is unusually well-supported for a plan; no revision needed.

3. **§6.1's create/edit routing question.** Did the requested independent resolution
   rather than relaying it back: read the actual issue text and its only comment (via
   `gh issue view 8 --json ... --comments`), the README's MVP bullet ("A task list sorted
   by due date" — no routing language), `router.ts` (single `/` route, no nav bar, no
   routed-CRUD precedent anywhere in the codebase), and scanned all other open issues
   (#9/#26/#34/#20/etc.) for any hint that something else needs a URL to link *into* a
   task edit page — found none. The issue's only comment frames the entire gap as
   "should be built from shared components, not... ad-hoc markup," which is a
   componentization complaint, not a routing complaint. I agree with the plan's default:
   in-page forms, not dedicated `/tasks/new`/`/tasks/:id/edit` routes. The plan's
   reasoning is sound and its "if the human disagrees" escape hatch is appropriately
   concrete. Nothing in the issue or codebase overrides this reading.

### Cross-checked against the actual codebase (not just the plan's description of it)

- `apps/server/src/services/task-service.ts` — confirmed `list()`'s current `orderBy`
  is exactly `{ dueDate: "asc" }` as the plan states.
- `apps/server/src/services/task-service.test.ts` line 45 — confirmed the exact
  assertion (`orderBy: { dueDate: "asc" }`) the plan says it will update.
- `apps/web/src/routes/task-list-item.tsx` — confirmed there is genuinely no due-date
  field in edit mode today (title/notes/tags only), matching the plan's stated gap and
  `tickets/task-crud/plan.md` §3.10's own documented scope cut.
- `apps/web/src/routes/tasks-page.tsx` / `task-create-form.tsx` — confirmed the "already
  mostly functional, just needs layout components" framing in §2 is accurate; create
  already wires title/due-date/notes/tags through the real `tasks.create` procedure.
- `apps/web/src/components/ui/section.tsx` / `panel.tsx` — confirmed `Section`'s `title`
  renders as an `<h2>`, so the planned `getByRole("heading", { name: "Tasks" })` test
  (§3.7) will actually pass against the real component, not an assumed API.
- `apps/server/src/services/task-schema.ts` / `schema-helpers.ts` — confirmed
  `taskUpdateFields.dueDate` is `wireDateTimeString.nullable().optional()`, i.e. the
  server-side null-vs-undefined semantics the plan's `dueDatePayloadForUpdate` (§3.3)
  depends on are exactly as described (explicit `null` clears, `undefined` leaves
  unchanged).
- `apps/web/src/routes/task-list-item.test.tsx` / `tasks-page.test.tsx` — confirmed all
  existing assertions are text/role/label-based, supporting the plan's claim (§3.5/§3.7)
  that the `Card`/`Section`/`Panel` markup changes won't require touching unrelated
  existing tests.

### Findings

No blocking issues found. This is a well-scoped, well-verified plan:

- **Scope fidelity**: matches the issue text and README MVP bullet closely — doesn't
  under-deliver (due-date editing gap genuinely closed, layout componentization genuinely
  done) and doesn't over-deliver (correctly declines Modal-based dialogs, dedicated
  routes, completed-task filtering, and notes truncation — none of which the issue or
  README ask for, and all explicitly justified in §5 rather than silently dropped).
- **Hidden assumptions**: the one genuine ambiguity (§6.1) is surfaced, reasoned through
  with real evidence, and resolved rather than punted — see above, I independently agree
  with the resolution rather than just accepting that it was flagged.
- **Edge cases**: §4 is thorough (no-due-date sort, unchanged-value round-trip for both
  date-only and date+time, explicit clear-to-null, the midnight-heuristic limitation,
  partial/legacy fixtures, concurrent-edit label collisions being pre-existing not new,
  save/toggle/delete failure paths). Nothing obviously missing.
- **Risk**: the two touched systems (SQLite query ordering, tRPC update payload shape)
  are both low-risk, easily reversible, and independently verified above rather than
  taken on faith.
- **Codebase fit**: the plan reuses every existing pattern exactly (the `editTitle`/
  `editNotes`/`editTags` state pattern for the new `editDueDateValue`, the
  `dueDatePayload`-adjacent-helper pattern in `task-due-date.ts`, the "Edit ..." label
  prefixing convention, the service-owns-query-logic / thin-procedure split from
  `AGENT_RULES.md`) rather than introducing a new one. No deviation from the tech-stack
  rules in `AGENT_RULES.md` (Prisma/SQLite portability is preserved — `nulls: "last"` is
  part of Prisma's cross-provider query API, not raw SQL; no `superjson`/`Date`-object
  handling introduced; service classes still own the logic, procedures stay thin).

Minor, non-blocking observations for the implementer (not scope/correctness gaps, so not
holding up approval on these):

- §3.4's description of how the `<li>`'s existing `flex flex-col gap-2` wrapper and the
  new `<Card padding="sm">` combine is slightly loose (which classes end up where) — normal
  level of detail for a plan, implementer will resolve it, but worth a second look in code
  review if the resulting spacing looks off.
- If PR #40 (Select/Datepicker refactor) merges mid-implementation, the due-date
  `fireEvent.change` interactions added in `task-list-item.test.tsx` (§3.5) may need the
  same follow-up `CalendarPopup`-interaction update that PR #40 already made to
  `task-create-form.test.tsx`. Already implicitly covered by the plan's general "adapting
  to a merged sibling PR is a follow-up's concern" stance; flagging only so it isn't a
  surprise mid-implementation.

VERDICT: APPROVED
