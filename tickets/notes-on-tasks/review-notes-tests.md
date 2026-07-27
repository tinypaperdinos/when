# Review notes — tests (reviewer-tests)

## reviewer-tests — round 1

Scope: diff `origin/main...feat/notes-on-tasks` (8 files, 338/5 lines) against
`plan.md` §3's edge-case list and issue #5. Verified by reading the diff, then
mutation-testing the implementation (reverting individual behaviors and confirming the
relevant test fails), then restoring the working tree to a clean state and re-running
both suites (`apps/server`: 50/50 passing, `apps/web`: 161/161 passing throughout).

### Confirmed by mutation testing (tests would catch a revert/regression)

- `task-service.ts` `create`: reverting `notes: input.notes ? input.notes : undefined`
  to `notes: input.notes` → caught by "normalizes a whitespace-only notes value to
  undefined..." (task-service.test.ts).
- `task-service.ts` `update`: reverting `notes: input.notes === undefined ? undefined :
  input.notes || null` to `notes: input.notes` → caught by "clears existing notes when
  notes is an empty string (post-trim)" (task-service.test.ts).
- `task-router.ts` `createInput.notes`: removing `.trim()` → caught by "trims a padded
  notes value before it reaches TaskService.create" (task-router.test.ts).
- `task-router.ts` `createInput`/`updateInput` `.notes`: adding a `.min(1)` constraint
  (i.e. accidentally copying the title validator) → caught by "does not reject an
  empty-string notes value on create/update, unlike title" (task-router.test.ts). This is
  exactly the accidental-copy scenario plan.md §3 flags as worth an explicit test, and it
  is.
- `task-create-form.tsx`: removing the `notes` key from the create payload, removing
  `setNotes("")` on success → both caught by task-create-form.test.tsx.
- `task-list-item.tsx`: removing `notes` from the update payload, removing the
  non-editing-view notes `<p>` → both caught by task-list-item.test.tsx (the latter also
  incidentally caught by the Cancel test, which asserts the read-only view still shows
  "Original notes").

These are all real regression-catching tests, not mock-call-only assertions — they
inspect the actual JSON body sent to `fetch` (web) or the actual `data` object passed to
the faked Prisma client (server), which is the right level to assert at given `fetch`/
`db` are the injected boundaries in this codebase's existing test style.

### Blocking

- **No test exercises `notes: null` through the actual router/Zod layer on `update`.**
  `updateInput` gains `notes: z.string().trim().nullable().optional()` in this diff, but
  every router-level test that touches `notes` only ever sends a string (`""`, `"   "`,
  or a padded value) — never `null`. I mutation-tested this directly: removing
  `.nullable()` from `updateInput.notes` (i.e. reverting to
  `z.string().trim().optional()`) leaves all 50 server tests green, yet a real client
  sending `{ notes: null }` — which is exactly what `task-list-item.tsx`'s `handleSave`
  sends when notes is cleared to empty (`notes: editNotes.trim() || null`) — is rejected
  by tRPC's input validator with `BAD_REQUEST` (`ZodError: expected string, received
  null`), confirmed by an ad hoc probe test against the real `appRouter`. The existing
  `task-service.test.ts` "clears existing notes when notes is null" test does cover the
  service in isolation, but it calls `service.update()` directly and bypasses Zod
  entirely, so it can't catch a schema regression. This is precisely the "clear notes"
  behavior plan.md §3 calls out ("`update` with `notes: null`: clears existing notes to
  `null`") and precisely the new code this ticket adds (`.nullable()` on the notes
  schema) — a regression here would silently break the UI's "clear notes" flow in
  production while CI stays green. Add a router-level test asserting
  `caller.tasks.update({ id, notes: null })` resolves and reaches
  `TaskService.update` with `notes: null` (mirroring the existing `notes: ""`/`"   "`
  non-rejection tests already present).

### Non-blocking

- The same gap (no router-level null-acceptance test) already exists for `dueDate` on
  `update` from the prior Task CRUD ticket (`origin/main`'s `task-router.test.ts` has no
  `dueDate: null` case either) — this diff doesn't introduce a new category of gap, it
  reproduces a pre-existing one on a second field. Worth a follow-up to backfill both,
  but not blocking this ticket on the pre-existing `dueDate` instance.
- No test covers `update`/`create` on a non-task entry combined with a `notes` payload
  specifically (e.g. `caller.tasks.update({ id: eventId, notes: "x" })` → `NOT_FOUND`).
  Plan §3 calls this out ("`notes` doesn't bypass `assertTaskExists`"), and it's true by
  construction (`assertTaskExists` runs before the `data` object is built, `notes` isn't
  referenced in the guard), but there's no explicit regression test pinning it down. Low
  risk since the guard clause is a single early-return unaffected by which fields are in
  `input`, and it's covered generically by other `NOT_FOUND` tests already in the suite.
- `apps/web/src/routes/task-list-item.tsx`'s `handleCancel` doesn't reset `editNotes`
  back to `task.notes` (it just flips `isEditing` off — the reset happens lazily on the
  next `handleEditClick`). The "Cancel discards a typed notes change" test only checks
  the read-only view and that `update` wasn't called; it doesn't check that re-opening
  Edit after Cancel shows the discarded value gone rather than stale. Existing `title`
  behavior has the identical gap (not introduced by this diff), so not blocking, but
  flagging since it'd be a one-line addition to the existing Cancel test.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scope: fix commit `a91cf5b` only (single new test in
`apps/server/src/routers/task-router.test.ts`), per the re-review-scope rule — round 1's
other findings (both non-blocking) are trusted as-is, not re-derived.

### Round-1 blocking finding: resolved

The new test, `"accepts notes: null and clears existing notes via TaskService.update"`
(`apps/server/src/routers/task-router.test.ts:214-231`), calls
`caller.tasks.update({ id: "1", notes: null })` through the real `appRouter` (imported
fresh, not a stub), against a `findUnique` mock returning a task with existing notes, and
asserts both that the call resolves and that the mocked `db.entry.update` (i.e. what
`TaskService.update` passes to Prisma) was called with `data: expect.objectContaining({
notes: null })`. This is the actual router → Zod → `TaskService.update` → Prisma-client
path, not a bypass — exactly what round 1 asked for.

I independently re-ran the fixer's claimed mutation test rather than trusting the commit
message: reverted `updateInput.notes` in `apps/server/src/routers/task-router.ts` from
`z.string().trim().nullable().optional()` back to `z.string().trim().optional()` (i.e.
removed `.nullable()`), ran `npm run test --workspace=apps/server -- --run`, and got
exactly one failure — the new test — with `Serialized Error: { code: 'BAD_REQUEST' }` /
`ZodError: ... "message": "Invalid input: expected string, received null"`, the other 50
tests unaffected. Restored the file (confirmed `git diff`/`git status` clean afterward)
and reran: all 51 tests pass. This matches the fixer's report precisely — the claim is
verified, not just trusted.

The assertion also isn't a mock-call-only check in the weak sense: it pins down the
actual `data.notes` value reaching the Prisma call (`null`, not `undefined` or omitted),
which distinguishes the "explicit clear" business rule
(`input.notes === undefined ? undefined : input.notes || null` in
`task-service.ts:47`) from the "leave untouched" case already covered by the existing
"wires the router to TaskService.update()" test (which omits `notes` entirely). Good
differential coverage between the two branches of that ternary at the router level, not
just the service level.

### New gaps introduced by this fix

None. The commit is additive only (19 lines, one new `it` block, no production code
touched, no existing test modified) — nothing to regress at the seams.

### Non-blocking (carried over from round 1, still true, not re-litigated)

- Round 1's two non-blocking findings (pre-existing `dueDate: null` router-test gap;
  no explicit `notes` + non-task-entity `NOT_FOUND` test; `handleCancel` not resetting
  `editNotes` state) are unaffected by this fix commit and still stand as non-blocking
  observations for a possible follow-up, not re-verified in detail this round per the
  re-review-scope rule.

VERDICT: APPROVED
