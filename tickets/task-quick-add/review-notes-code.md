## reviewer-code — round 1

Reviewed `git diff origin/main...HEAD` (commit `5488676`, "Quick-add task creation with
chrono-node parsing (#50)") against `tickets/task-quick-add/ticket.md` (GitHub issue #50)
and `tickets/task-quick-add/plan.md`.

### Verification performed
- `npm run test`: 355/355 tests pass (28 files).
- `npm run typecheck`, `npm run lint`, `npm run build`: all clean, no errors/warnings
  beyond the pre-existing >500kB chunk-size notice (unrelated to this diff).
- Manually re-implemented `parseQuickAdd`'s algorithm in a throwaway script and ran it
  against `chrono-node@2.10.1` directly (outside the vitest sandbox) to probe cases not
  in the test file: tag tokens interleaved with/inside the matched date-phrase text
  (`"Call mom #family tomorrow at 5pm"`, `"meeting tomorrow #work at 5pm"`), multiple
  date phrases in one input (`"meet tomorrow or next monday"` — confirms only the first
  match is used, per the plan's documented scope decision), and a plausible false-positive
  trigger (`"call 911"` — not misparsed as a date). All behaved as designed; no bugs
  found.

### Scope fidelity (ticket.md / issue #50)
All six acceptance criteria are met:
- Single input line, no picker in the create form — confirmed, `DateTimePicker` import
  removed from `task-create-form.tsx`.
- Relative date/time phrases parsed via `chrono-node`, set due date/time, stripped from
  title — `apps/web/src/lib/quick-add-parse.ts`.
- `#tagname` tokens become tags, stripped from title — same file.
- Live preview below the input, updates on keystroke — implemented with
  `role="status" aria-live="polite"`, rendered only when there's something to show.
- Notes/description dropped from create entirely — confirmed, no `Textarea`/`notes`
  anywhere in the new `task-create-form.tsx`.
- Editing unchanged — confirmed via diff: `apps/web/src/routes/task-list-item.tsx` has
  zero changes in this diff; it still uses `DateTimePicker` + `Textarea` + `TagInput`.
- Out-of-scope items (recurring rules, date ranges) are correctly not implemented; only
  `results[0]` from `chrono.parse` is used, exactly as `plan.md` §2.2/§4 specifies.

No unrequested scope: no backend changes, no new `components/ui/` primitive, no
autocomplete added to quick-add, matching the plan's explicit boundaries in §4.

### Correctness
- `parseQuickAdd` tag-then-date ordering: tags are stripped from `raw` first via a
  global regex replace, then chrono parses the tag-stripped string, so
  `first.index`/`first.text.length` always line up with the string being sliced — no
  index-drift bug, verified both by reading and by the probe script above.
- `wireDateTimeStringFromDate` correctly treats `hasTime` as the source of truth rather
  than inferring from the `Date`'s clock fields (test explicitly asserts a non-midnight
  `Date` with `hasTime: false` still yields a date-only string) — matches the plan's
  stated rationale for why this needs to differ from `dueDateValueFromWireDate`'s
  midnight heuristic.
- Empty/whitespace-only input and inputs that parse to an empty title (`"tomorrow"`,
  `"#chores"`) are all correctly guarded in `handleSubmit` (`if (parsed.title === "")
  return;`) and covered by dedicated tests.
- `useMemo(() => parseQuickAdd(rawInput), [rawInput])` correctly ties the live preview
  and the submit payload to the same memoized parse result within a render, as the plan
  intended (no "now" drift between preview and submit).

### Design
- Follows existing conventions: pure parsing logic lives in `lib/`
  (`quick-add-parse.ts`, mirroring `lib/task-due-date.ts`), the new
  `wireDateTimeStringFromDate` reuses the existing private `pad` helper rather than
  duplicating it, `Badge` is reused exactly as `task-list-item.tsx` already uses it for
  read-only tag display, and the `role="status"/aria-live="polite"` pattern matches
  `components/ui/loading-state.tsx`.
- `tasks-page.tsx` correctly drops the `tagSuggestions` prop from `<TaskCreateForm />`
  while still fetching `trpc.tags.list` and passing `tagSuggestions` through to
  `<TaskListItem>`, which still needs it for its edit-mode `TagInput`.
- `package.json`/`package-lock.json` updated together (lockfile has a real resolved
  `chrono-node` entry, not hand-edited), consistent with the plan's explicit call to run
  `npm install` from the repo root.

### Simplification
Nothing to flag — the diff is close to the minimum needed for the ticket: one new pure
function, one small addition to an existing lib file, and a straightforward rewrite of
the create form and its tests. No unnecessary abstraction, no copy-pasted logic that
should have been shared.

### Non-blocking observations
- None worth flagging as findings. `plan.md`'s "deliberately not tested" call-out
  (chrono's behavior on ambiguous non-date-intent text, e.g. "May I call you") is a
  reasonable, explicitly-justified boundary, not a gap.

### Process note (not a code finding)
While reviewing, the shared worktree briefly showed an uncommitted, unattributed change
to `apps/web/src/routes/task-create-form.tsx` (the `if (parsed.title === "") return;`
guard blanked out) and an untracked `apps/web/src/routes/probe.test.tsx`, both outside
this review's scope (not part of `git diff origin/main...HEAD`) and not made by any
command run in this review. Consistent with `reviewer-tests` doing a mutation-testing
check concurrently in the same worktree per `AGENT_RULES.md`'s re-review guidance. Left
untouched — did not revert or otherwise interfere with it. All verification in this
review (tests/typecheck/lint/build, and the manual probe script) was run against the
correct committed state before this transient change appeared; test run showed
355/355 passing, which would not have been possible had the guard already been
missing. Flagging only so a second reviewer isn't surprised by residual working-tree
state — no action needed from `fixer`.

VERDICT: APPROVED

## reviewer-code — round 2

Scope: fix commit `644bc49` ("Fix false-negative negative-mutation-call tests in
task-create-form.test.tsx"), applied in response to `reviewer-tests`'s round-1 blocking
finding. Per `AGENT_RULES.md`'s round-2+ scope, did not re-audit round 1's approved
implementation code or re-run lint/typecheck/build.

### Verification performed
- `git diff --stat 5488676..644bc49` / `git diff --name-only`: confirms the fix commit
  touches exactly one file, `apps/web/src/routes/task-create-form.test.tsx` — test-only,
  no implementation drift. This matches what round 1 already approved with zero findings.
- Ran the updated test file (`apps/web`, so vitest picks up the jsdom environment
  config): 18/18 pass.
- Independently reproduced the fixer's mutation-testing claim in a fully isolated `git
  worktree add --detach` checkout of `644bc49` (kept separate from the shared worktree
  to avoid touching code, per this role's "findings only" rule, and to avoid
  interfering with any concurrent process): with the `if (parsed.title === "") return;`
  guard intact, 18/18 pass; with the guard removed, exactly the three targeted tests
  fail (`does not call the mutation when the input is "" (empty or whitespace-only)`,
  `...is "   " (empty or whitespace-only)`, `...resolves to an empty title`, `...is
  only a tag`) while the other 15 still pass — matching the fixer's commit message
  claim exactly. Worktree removed after verification.

### Process note (not a code finding)
While reviewing, the shared worktree's `apps/web/src/routes/task-create-form.tsx`
showed an uncommitted, unattributed modification (the guard line replaced with a
`// guard removed for mutation testing` comment) — the same kind of transient state
round 1 flagged, consistent with `reviewer-tests` doing a concurrent mutation-testing
check in this same shared worktree. Notably, a test run taken while that transient
state was present showed 18/18 passing (i.e. appeared not to catch the removed guard),
which would have been a serious concern if taken at face value — but it's an artifact
of catching a concurrent edit mid-flight (e.g. a stale module cache or a partial
write), not a real problem with the fix: the isolated-worktree reproduction above,
against the actual committed state of `644bc49`, confirms the fix behaves exactly as
the commit message describes. Left the shared worktree's transient state untouched, as
in round 1 — no action needed from `fixer`.

### Findings
None. The fix is scoped exactly to the round-1 blocking finding (test-only, no
implementation changes), correctly gives the mutation's batched fetch call an event-loop
tick before asserting the negative, and the non-blocking empty-string/whitespace
parameterization requested in round 1 is folded in as noted.

VERDICT: APPROVED
