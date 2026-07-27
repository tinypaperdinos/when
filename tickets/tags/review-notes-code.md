# Review notes (code): tags

## reviewer-code — round 1

Reviewed `git diff main...feat/tags` (PR #37, commit `53fa155`) against `ticket.md`
(GitHub issue #6), `plan.md`, and `refiner-notes.md`'s round-1 findings. Ran the full
local check suite in addition to confirming CI (`gh pr checks` — `build` job green,
covers lint/typecheck/test/build): `npm test -w apps/server` (112 passed),
`npm test -w apps/web` (212 passed), `npm run typecheck --workspaces` (clean),
`npm run lint --workspaces` (clean), `npm run build --workspaces` (clean). Also manually
exercised `prisma/seed.ts` end-to-end against a scratch SQLite DB (`prisma migrate deploy`
+ `tsx prisma/seed.ts` run twice back-to-back) to confirm the upsert-based idempotency fix
actually works at runtime, not just on paper — both runs completed with no error.

### The five refiner-notes.md round-1 notes — four addressed, one not folded in

1. **Router filename → singular `tag-router.ts`.** Addressed. The new files are
   `apps/server/src/routers/tag-router.ts` / `tag-router.test.ts` (verified via `ls`/diff),
   matching `task-router.ts`/`event-router.ts`'s singular-filename/plural-export-name
   convention. `tagsRouter` export name and `tags:` registration key in `app-router.ts`
   are unchanged, as intended.
2. **`TagService` DI honestly flagged as new, not oversold as matching style.** Addressed.
   `task-service.ts`'s constructor now carries an explicit comment: "Second constructor
   param is new for this codebase — no existing service currently composes another
   service." This is accurate framing, not the plan's original "matches this codebase's
   plain-constructor-injection style" language.
3. **`orderBy` case-sensitivity comment.** Addressed. `tag-service.ts`'s `list()` has a
   comment explaining the ASCII/case-sensitive sort is a direct, accepted consequence of
   case-preserving storage, with a pointer to `plan.md` §2.3.
4. **Orphaned-tag partial-failure edge case awareness — NOT folded in.** Not addressed.
   Neither `plan.md` (§2.3/§5, where the refiner suggested a one-line addition) nor any
   code comment in `tag-service.ts`/`task-service.ts` mentions the distinct failure mode
   the refiner flagged: `resolveConnections` successfully creating one or more new `Tag`
   rows, followed by the subsequent `db.entry.create`/`db.entry.update` call failing for
   an unrelated reason (e.g. a `NOT_FOUND` race on `update`), leaving the newly-created
   `Tag` row(s) orphaned. The refiner explicitly called this "a distinct scenario from the
   [concurrent-create race]... isn't currently named anywhere" and asked for one line in
   §2.3 or §5. **Non-blocking** — the refiner's own note said this doesn't change the
   already-accepted "orphaned tags are fine" trade-off, and no code change is needed, only
   documentation — but since the task brief explicitly asked to confirm the five notes
   were "actually addressed, not just claimed," flagging that this one wasn't.
5. **`seed.ts` idempotency via upsert instead of nested create.** Addressed, and verified
   at runtime (see above) — `tagConnection()` uses `db.tag.upsert({ where: { name }, ... })`
   instead of nested `tags: { create: [...] } }`, with a comment citing the refiner note.
   Re-running the seed script twice against the same DB succeeds both times with no unique-
   constraint error.

### Scope fidelity vs. `ticket.md` / issue #6

Matches the issue's literal ask precisely, with no under- or over-scoping:
- Tag relation exposed via tRPC: `tags.list` (new `tag-router.ts`).
- Create/assign/remove tags on a task: `tags: string[]` added to both `taskCreateInput`
  and `taskUpdateFields`, wired through `TaskService.create`/`update`.
- Tags shown in the task list UI: `TaskListItem`'s read view renders `Badge` per tag.
- Uses the shared `TagInput`/`Badge` components from `tag-input-badge`, per the issue's
  explicit dependency — confirmed `apps/web/src/components/ui/tag-input.tsx`/`badge.tsx`
  are untouched (`git diff` empty for both).
- `EventService`/`event-router.ts`/`event-schema.ts` correctly untouched (`git diff`
  empty for all three), matching plan §2.1's task-only scope call, which the refiner
  independently confirmed against `README.md`'s MVP list.
- No Prisma migration, no tag-deletion/rename endpoint, no per-tag color, no tag-based
  filtering — all correctly out of scope per plan §5, and none were added.

### Correctness

Spot-checked the trickier logic paths directly (not just via the tests, which are
thorough and match `plan.md` §4's edge-case list closely — cross-checked line by line):
- `TaskService.create`/`update`'s omitted-vs-`[]`-vs-non-empty `tags` handling matches
  the plan's spec exactly, including the asymmetry between `create` (empty array →
  same as omitted, no `tags` key at all) and `update` (empty array → explicit
  `{ set: [] }`, clearing all tags). Verified against both `task-service.test.ts` and
  `task-router.test.ts`'s end-to-end tests, all passing.
- `TagService.resolveConnections`'s case-insensitive dedup/match/create logic is correct:
  dedupes the input list case-insensitively (keeping first-seen casing), matches
  case-insensitively against existing rows, creates only unmatched names, and pushes
  newly-created rows into the in-memory `existing` array so later names in the same call
  see them (needed since it's an N+1 sequential loop, not a single query — correctly
  avoids creating duplicate tags within one `resolveConnections([...])` call for
  e.g. `["work", "Work", "WORK"]`).
- `TasksPage`'s `isLoading`/`isError` staying keyed off `tasks.list` only (not
  `tags.list`) is implemented as planned — a failed/slow tag fetch doesn't block the task
  list.
- No manual edit to `apps/web/src/trpc.ts`, confirmed unnecessary since `Task`'s inferred
  type already carries `tags: { id: string; name: string }[]` through `AppRouter`
  inference — `tsc -b` passes clean, so this wasn't a false assumption.

No unhandled edge cases found beyond the two explicitly-and-correctly-deferred ones
(concurrent identical-tag-creation race, orphaned-`Tag`-row GC) that `plan.md` §5
documents as accepted non-goals.

### Design

Fits the codebase's existing patterns well. The one new pattern (`TaskService` composing
`TagService` via a defaulted constructor param) is reasonable and, per note 2 above, now
honestly flagged as new rather than claimed to match precedent. No unnecessary
abstraction; no copy-pasted logic that should have been shared (the case-insensitive
matching logic lives in exactly one place, `TagService.resolveConnections`, not
duplicated between `create`/`update`).

### Simplification

Nothing found that would materially simplify this without losing correctness. The
full-array-sync approach (`tags: string[]` on `create`/`update`) is simpler than the
alternative (three separate `assign`/`remove`/`create` procedures) and matches how every
other optional field on `tasks.update` already works.

### Verified independently

- `npm test -w apps/server`: 112 passed.
- `npm test -w apps/web`: 212 passed.
- `npm run typecheck --workspaces`: clean.
- `npm run lint --workspaces`: clean.
- `npm run build --workspaces`: clean (server `tsc`, web `tsc -b && vite build`).
- `gh pr checks` / `gh pr view 37`: CI `build` job green, PR still draft as expected
  before the fix loop closes out.
- Manual `prisma/seed.ts` re-run (twice, scratch DB): no error either run, confirming the
  idempotency fix from note 5 works at runtime, not just by inspection.

VERDICT: APPROVED
