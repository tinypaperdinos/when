## reviewer-tests — round 1

Reviewed `git diff origin/main...feat/task-quick-add` (merge-base `dbaedad`, tip
`5488676` "Quick-add task creation with chrono-node parsing (#50)") against
`tickets/task-quick-add/plan.md` §3's test plan and issue #50's acceptance criteria.
Confirmed via `git diff` that the working tree of `feat/task-quick-add` is byte-identical
to what's already on `origin/main` at this commit (the PR content landed on main even
though PR #52 metadata still shows draft/open) — reviewed the diff content itself,
which is unambiguous either way.

### Verification performed
- `npx vitest run` on all four touched/added test files: 57/57 pass on the committed
  code (baseline).
- Mutation testing (per `AGENT_RULES.md`'s testing conventions) on every behavior change
  called out in `plan.md` §2, applied one at a time in this worktree and reverted after
  each check, confirming the working tree matches the baseline before finishing:
  1. Dropped `{ forwardDate: true }` from the `chrono.parse` call →
     `quick-add-parse.test.ts`'s "june 3" test fails as designed. Confirms the plan's own
     claim about which test exercises this option.
  2. Hardcoded `dueDateHasTime = false` (bypassing `isCertain("hour")`) → caught by both
     `quick-add-parse.test.ts` ("Call mom tomorrow at 5pm #family") and
     `task-create-form.test.tsx` ("submits a dueDate payload with a time component...").
  3. Widened `TAG_PATTERN` to allow zero characters after `#` (i.e. removed the
     "must have ≥1 non-whitespace, non-`#` char after `#`" constraint) → caught by the
     `"# tag"`/`"C#"` tests in `quick-add-parse.test.ts`.
  4. Removed the whitespace-collapse/trim step on the derived title → caught by the
     combined-phrase test ("Call mom tomorrow at 5pm #family" → title has trailing
     spaces, test fails as expected).
  5. Replaced `hasPreview`'s real condition with a constant `true` → caught by "shows
     nothing when neither a date phrase nor a tag is present".
  6. **Removed the `if (parsed.title === "") return;` guard in `handleSubmit` entirely
     → all 17 tests in `task-create-form.test.tsx` still pass, including the three tests
     specifically written to cover this guard.** See blocking finding below.

### Blocking

**The three "does not call the mutation" tests in `task-create-form.test.tsx` (lines
163–200: `"does not call the mutation when the input is empty or whitespace-only"`,
`"...when the input resolves to an empty title"`, `"...when the input is only a tag"`)
do not actually test the empty-title guard.** Each does `fireEvent.change(...)` then
`fireEvent.click(...)` then immediately (synchronously, no `await`/`waitFor`) asserts
`expect(fetchImpl).not.toHaveBeenCalled()`. Verified by deleting
`if (parsed.title === "") return;` from `task-create-form.tsx` and re-running the file:
all 17 tests still pass — these three included. Further isolated with a throwaway probe
test: with the guard removed, `fetchImpl` *is* eventually called, but only after
`await waitFor(...)` — confirming the mutation genuinely does fire once the guard is
gone, it's just that `createMutation.mutate(...)`'s underlying fetch call happens on a
microtask tick after the synchronous click handler returns, and these three tests never
yield to let that tick happen before asserting the negative. Contrast with every
positive-path test in the same file (`"submits the trimmed title..."`, etc.), which all
correctly `await screen.findByRole(...)` before inspecting `fetchImpl.mock.calls` — the
pattern to catch a real regression exists in this same file, it just wasn't applied to
the three negative-assertion tests. This is exactly the failure mode `AGENT_RULES.md`'s
mutation-testing check exists to catch: a test that is green against both the correct
implementation and the reintroduced bug isn't testing the change. Fix: give the event
loop a tick before the negative assertion, e.g.
`await new Promise((r) => setTimeout(r, 0));` or an equivalent `waitFor`-based flush,
in each of the three tests.

### Non-blocking

- `"does not call the mutation when the input is empty or whitespace-only"` only
  exercises the whitespace-only case (`"   "`), not a truly empty string (`""`). In
  practice a literal empty string would likely also be blocked by the `TextInput`'s
  `required` HTML attribute before `handleSubmit` even runs, so this is a minor
  redundancy gap rather than a real coverage hole — not blocking on its own, but worth
  folding in while fixing the async issue above (e.g. parameterize the test over both
  `""` and `"   "`).
- `quick-add-parse.test.ts` and `task-create-form.test.tsx` don't have a case for a tag
  token that overlaps/sits inside the matched date-phrase substring (e.g.
  `"meeting tomorrow #work at 5pm"`, where a tag token falls between the date phrase's
  start and end after tags are stripped first). `reviewer-code`'s notes record this was
  manually probed against real `chrono-node` output and behaves correctly; since tags
  are always stripped before date parsing runs (per `quick-add-parse.ts`'s own comment),
  index-drift from an interleaved tag is structurally impossible, not just untested —
  low value to add a dedicated test for this, flagging only for visibility.
- No test exercises what the *server* schema does with a `dueDate` string produced by
  `wireDateTimeStringFromDate` end-to-end (i.e. that the wire format quick-add produces
  is accepted by `taskCreateInput`). Existing `task-schema.test.ts` coverage of the wire
  format (from other tickets) plus the fact that `wireDateTimeStringFromDate` produces
  the same `YYYY-MM-DD[THH:mm]` shape as `dueDatePayload` already covers this
  implicitly — not worth a new integration test.

### plan.md §3 coverage check

All other enumerated cases in §3.1/§3.2/§3.3 are present and, per the mutation checks
above, actually would fail if the corresponding implementation logic regressed:
tag dedup/case-preservation, tag-position/whitespace collapsing, `forwardDate` behavior,
`dueDateHasTime` certainty, `wireDateTimeStringFromDate`'s two branches, preview
show/hide/swap, `role="status"`/`aria-live="polite"`, and the default-`referenceDate`
wiring via `vi.setSystemTime`. The `tasks-page.test.tsx` deletion (removing the
`tagSuggestions`-threading test with no replacement) matches §3.4 exactly and is
justified there.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scoped to the fix commit only, per `AGENT_RULES.md`'s round-2+ scope rule: `git show
644bc49` (touches only `apps/web/src/routes/task-create-form.test.tsx`, 24
insertions/11 deletions, no other files).

### Independent re-verification of the round-1 blocking finding

Reproduced the exact mutation-testing check that produced the original finding, on this
worktree, without relying on the fixer's report:

1. Baseline: `npx vitest run src/routes/task-create-form.test.tsx` → 18/18 pass.
2. Removed the guard (`if (parsed.title === "") return;` → replaced with a comment) in
   `task-create-form.tsx`.
3. Re-ran the same file → **3 failed, 15 passed**, and the 3 failures are exactly the
   three tests the round-1 finding was about:
   - `does not call the mutation when the input is "   " (empty or whitespace-only)`
   - `does not call the mutation when the input resolves to an empty title`
   - `does not call the mutation when the input is only a tag`
   Each failure shows `fetchImpl` was actually called once with the expected
   `tasks.create?batch=1` body (e.g. `{"title":"","tags":["chores"]}` for the tag-only
   case), confirming the assertion is now observing the real batched dispatch rather
   than a premature synchronous check.
4. Restored the file from a backup taken before the mutation (`cp` round-trip),
   confirmed `git status --porcelain` on the file is empty (byte-identical restore), and
   re-ran the file once more → clean 18/18 pass.

This independently confirms the fixer's report: the guard is genuinely covered now, not
just claimed to be. The blocking finding from round 1 is resolved.

One residual, non-blocking observation not called out in the fix commit message: in the
parameterized `it.each(["", "   "])` pair, only the `"   "` case is among the 3 that
fail when the guard is removed — the `""` case stays green either way. This lines up
with round 1's own non-blocking note (a literal empty string is likely already blocked
by the `TextInput`'s `required` HTML attribute before `handleSubmit` runs at all, so
jsdom's constraint validation — not the guard under test — is what stops that case).
The parameterization is still a net improvement (folds in the round-1 non-blocking
ask, and doesn't weaken anything), but it's worth being precise that the `""` branch of
that `it.each` is not actually exercising the guard; it's redundant coverage of form
validation from a different code path. Not blocking — round 1 already assessed this gap
as low-value/structural, and the fixer didn't claim otherwise.

### Other checks

- Full frontend suite: `npx vitest run` → 28 files / 356 tests pass, matching the
  fixer's reported count exactly.
- No other files changed in the fix commit, so no new surface to review (no new
  behavior changes, no other test files touched).
- Per the re-review scope rule, did not re-run lint/typecheck/build (CI already covers
  these) and did not re-derive the rest of round 1's findings — they stand as approved.

VERDICT: APPROVED
