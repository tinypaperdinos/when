# Review notes (tests): tags

## reviewer-tests — round 1

Reviewed `git diff main...feat/tags` (PR #37, commit `53fa155`) against `plan.md` §4's
edge-case list and `ticket.md` (GitHub issue #6). Ran the touched test files individually
and the full suites (`npm test -w apps/server`: 112 passed; `npm test -w apps/web`: 212
passed) — all green. Files noted in the task as "tag-router.test.ts"/"tags-router.ts" in
`plan.md` actually landed as singular `tag-router.ts`/`tag-router.test.ts` (already
flagged and accepted in `review-notes-code.md` round 1); no test-coverage impact from the
rename.

### Mutation-tested claims (didn't just trust that a test exists — reverted the
implementation logic behind each and confirmed the test suite actually catches it, then
restored the file to its original diff state each time; `git status`/`git diff` clean
afterward)

1. **Case-insensitive tag matching (`TagService.resolveConnections`).** Changed the two
   `.toLowerCase()` comparisons to exact `===` (reintroducing the "Work"/"work" duplicate-
   tag bug §2.3 rejected). Result: 3 of 8 `tag-service.test.ts` tests failed, including the
   dedicated case-insensitivity assertion. Confirms real coverage, not a tautological test.
2. **Omitted-vs-empty-array `update` semantics (`TaskService.update`).** Changed the tags
   condition from `input.tags === undefined` to `input.tags === undefined ||
   input.tags.length === 0` (collapsing "clear all tags" into "leave untouched," the exact
   bug §2.2/§4 calls out). Result: the dedicated
   `"calls tagService.resolveConnections with [] and explicitly clears all tags..."` test
   failed immediately. Confirms this asymmetry is genuinely tested, not just asserted
   against itself.
3. **Web-side `TaskListItem` clear-last-tag path.** Changed `handleSave`'s payload from
   always-`tags: editTags` to `editTags.length > 0 ? editTags : undefined` (reintroducing
   "empty array silently becomes omitted" at the UI layer). Result: 4 of 30
   `task-list-item.test.tsx` tests failed, including the dedicated
   `"sends tags: [] explicitly after removing the only tag in edit mode"` test. Confirms
   real, reachable-UI-path coverage of the omitted-vs-`[]` distinction, not just a
   server-side unit test standing in for it.
4. **Batch-aware fetch mock in `tasks-page.test.tsx` (the specific thing flagged in the
   task brief).** Removed `TasksPage`'s `trpc.tags.list` query entirely (reverting to a
   hardcoded `tagSuggestions: string[] = []`, no second query fired). Result: the
   `"threads the fetched tag list into the create form as suggestions"` test failed
   (`findByRole("option", { name: "urgent" })` never appears) while the other batch-mock-
   using tests kept passing. Confirms `batchFetch`'s comma-joined-path parsing genuinely
   exercises the second (`tags.list`) procedure in the batch, not just satisfying
   TypeScript / trivially passing regardless of whether `tags.list` is wired up. Worth
   noting for future readers: the *other* new test in this file,
   `"renders a tag badge for a task that has tags"`, does **not** by itself prove
   `tags.list` wiring — the badge is rendered from `task.tags` (part of the `tasks.list`
   fixture), not from the `tags.list`-derived `tagSuggestions` prop. That's fine; it's
   testing a different, also-real behavior (badge rendering), and the suggestions test
   is the one that actually covers the batching claim — just flagging so a future
   reviewer doesn't double-count it as batching coverage.

### Plan §4 edge cases — coverage check

All of `plan.md` §4's `TagService`, `TaskService`, `tasksRouter`, `tagsRouter` edge cases
are present and, per the mutation tests above, load-bearing:
- `TagService`: empty-array short-circuit (`db.tag.findMany` not called), case-insensitive
  match reuse (no `create` call), casing-preserving create on no-match, in-call dedup of
  case variants (single `create` call, length-1 result), mixed match+new in one call,
  `list()` asserts the `orderBy` arg rather than re-sorting client-side.
- `TaskService`: `create`/`update` omitted-vs-`[]`-vs-non-empty tags, `resolveConnections`
  not called when appropriate (`.not.toHaveBeenCalled()`, not just absent from an
  assertion), `list()` include assertion.
- `tasksRouter`: empty-string-in-array and non-array `tags` rejected pre-service
  (`entry.create`/`update` and `tag.*` all asserted not-called), one non-empty `create`
  end-to-end, one empty-array `update` end-to-end.
- `tagsRouter`: wiring assertion plus empty-DB case.
- Web: `TaskCreateForm` add/omit/clear-on-success/suggestion-surfacing/no-suggestions-prop
  cases; `TaskListItem` badge rendering (populated/empty/undefined-fixture-defensive),
  edit-mode pre-fill (populated/empty), add/remove/clear-last-tag on Save (with the actual
  JSON request body parsed and asserted via `JSON.parse(init.body)`, not a mocked-call
  assertion), Cancel-discards-tag-change.

One plan §4 web bullet — *"Save with no tag changes at all still includes `tags: [...]`
(the unchanged array)"* — has no single dedicated test with that exact shape (pre-existing
non-empty tags, edit only the title, assert the unchanged tag array round-trips). It's
adequately covered in combination though: the three pre-existing title/notes-focused Save
tests confirm `tags` is always present (never omitted) when the fixture's tags are empty,
and the new `"...adding a tag in edit mode"` test starts from a *non-empty* fixture
(`tags: [{ id: "t1", name: "urgent" }]`) and asserts the final payload is
`["urgent", "home"]` — which only holds if `editTags`'s initial state correctly picked up
the pre-existing "urgent" tag rather than starting empty, i.e. it already exercises the
"unchanged tag survives an edit-mode Save" behavior as a side effect. **Non-blocking**:
genuinely covered, just not via a standalone test with that exact framing.

### Assertions are on real behavior, not mock-call bookkeeping

Web-side create/update payload assertions consistently parse the actual serialized
`fetch` request body (`JSON.parse(init.body as string)`) rather than asserting a mutation
function was "called with" an object — this means they'd catch a bug in the mutation
hook's serialization path too, not just in the component's prop-passing. Server-side
service/router tests mix `toHaveBeenCalledWith` (appropriate there, since the unit under
test *is* the call boundary to `db`/`tagService`) with return-value assertions
(`expect(result).toEqual(...)`) — not purely mock-presence checks.

### Nothing else worth flagging

- `prisma/seed.ts` changes have no dedicated test, matching `plan.md` §3.6's "small,
  not blocking" framing — `review-notes-code.md` round 1 already confirms this was
  manually verified at runtime instead.
- Event-side: correctly no new tests, since `EventService`/`event-router.ts`/
  `event-schema.ts` are untouched (confirmed via `git diff --stat`).
- Concurrent-identical-tag-creation race and orphaned-`Tag`-row GC: correctly untested,
  per `plan.md` §4/§5's explicit "not planned as a dedicated test" list — no code path
  exists to exercise either.

VERDICT: APPROVED
