# Review notes (code): tag-input-badge

## reviewer-code — round 1

Reviewed the actual ticket commit `90e0162` (`feat(web): add Badge and TagInput
components to the UI library`, PR #36), isolated via `git diff 43bd45b..90e0162` since
local `main` is currently behind `origin/main` and a raw `main...feat/tag-input-badge`
diff pulls in unrelated already-merged commits (`event-crud`, `shared-zod-schemas`) — not
part of this ticket's scope, ignored. Read `ticket.md` → `gh issue view 17` (verbatim
match to what `plan.md` quotes), `plan.md` (round-2 revised), and
`refiner-notes.md` (both rounds) before reviewing.

### Checks performed

- Read the full diff for `badge.tsx`, `tag-input.tsx`, `badge.test.tsx`,
  `tag-input.test.tsx`, `ui-demo-page.tsx`/`.test.tsx`, `components/ui/README.md`.
- Confirmed `apps/web/src/components/ui/text-input.tsx` is untouched by this commit
  (`git diff 43bd45b..90e0162 -- .../text-input.tsx` is empty) and still a plain function
  component, no `forwardRef` — the plan's round-2 revision (dropping the `forwardRef`
  touch entirely) held exactly as described. Confirmed.
- Ran `npx vitest run` on the three touched/new test files: 52/52 pass.
- Ran `npm run lint --workspace=apps/web`, `npm run typecheck --workspace=apps/web`, and
  `npm run build --workspace=apps/web` directly (round 1, not a re-review round, so the
  "don't re-run these" rule doesn't apply yet) — all clean, matching `gh pr checks 36`
  (`build` job: pass).
- Note: mid-review, `git status` briefly showed an uncommitted local modification to
  `tag-input.tsx` removing the `onMouseDown={preventDefault}` handler; re-checking
  seconds later showed it gone again (working tree clean except `tickets/tag-input-badge/`
  itself). This is almost certainly `reviewer-tests` running its own mutation-testing
  check concurrently in the same shared working directory (matching the pattern the
  implementer's own code comment in `tag-input.tsx` describes: "verified by temporarily
  deleting the handler... and confirming this assertion failed, then restoring it"), not a
  real, persistent finding — noting it here only so a second reviewer doesn't get confused
  by a stray transient diff if they happen to catch it mid-flight. The actual committed
  code (`90e0162`) has the handler; not a finding against the diff.

### Scope fidelity vs. `ticket.md` (issue #17)

Matches. Both named deliverables exist (`Badge`, `TagInput`), both are presentational/
component-library-only with no live data source (correct per plan §2.3 — #6/#8 don't
exist yet), no backend/Prisma/tRPC changes, no new npm dependency (`git diff` confirms
`package.json`/`package-lock.json` untouched), demo route + README updated per the
established `components/ui/` convention. No unrequested scope found (no `size` variant, no
`Tag.color` field, no wiring into a real feature page — all correctly deferred per plan
§5).

### Correctness

No blocking issues found. Walked the diff against every edge case in plan §4 and spot-
checked the corresponding test; all match the implementation as written (Enter/Escape/
Backspace/ArrowUp/ArrowDown/disabled/duplicate-dedupe/freeform-degrade/two-instance-id-
collision behaviors all present and correctly wired). Two minor, non-blocking gaps found:

1. **Non-blocking — stale `highlightedIndex` not reset on blur.** `onBlur={() =>
   setOpen(false)}` (tag-input.tsx) closes the dropdown but does not reset
   `highlightedIndex` to `null` (only `Escape` and `commitTag` do that). Concrete scenario:
   user types a match, presses `ArrowDown` (highlight index 2 of 3 matches), then blurs
   the field (e.g. Tab/click away) without committing. `highlightedIndex` stays `2`. On
   refocus (`handleFocus` → `recomputeOpen`), if the freshly-recomputed `filtered` list now
   has fewer than 3 entries (e.g. `value` changed elsewhere, or `draft` didn't change but
   `suggestions`/`value` did via a parent re-render), `aria-activedescendant` on the input
   points at `${listboxId}-option-2`, an id that doesn't exist in the DOM (only options 0
   and 1 are rendered) — an invalid ARIA reference. Low real-world impact (most refocuses
   happen with `filtered` unchanged), not covered by plan §4's edge case list either, so
   not something the implementer skipped against an explicit spec — flagging as a rough
   edge worth a one-line fix (`setHighlightedIndex(null)` alongside `setOpen(false)` in the
   `onBlur` handler) in a future pass, not blocking this PR.

2. **Non-blocking — chip removal by exact-string match assumes `value` has no
   duplicates.** `onClick={() => onChange(value.filter((v) => v !== tag))}` combined with
   `key={tag}` on each `Badge` (tag-input.tsx) removes *every* entry matching `tag`, not
   just the clicked instance. `TagInput`'s own `commitTag` guarantees no duplicates when
   tags are added through its UI, but `value` is an externally-controlled prop (per the
   controlled-only composite pattern) — a consumer that seeds `value` with an actual exact
   duplicate (e.g. `["work", "work"]`, perhaps from unvalidated data before #6 is built)
   would get a React key collision warning and a remove-click that deletes both entries at
   once instead of one. Not tested, not mentioned in plan §4/§5. Realistically low risk
   (every current caller — the demo route — passes deduped arrays), and case-insensitive
   dedup is explicitly out of scope for value-shape validation per plan §2.3/§5. Flagging
   for awareness, not blocking.

### Design

Fits the established `components/ui/` composite pattern well (`DateTimePicker`/
`DateRangePicker` precedent correctly extended, README updated consistently in both
places §3.6 specifies). One minor **simplification** opportunity, non-blocking: the
suggestion-filtering logic is duplicated between the top-level `filtered` derivation and
`recomputeOpen()` (same two `.filter()` calls, `recomputeOpen` just omits the `.slice()`
since it only needs "is this list non-empty"). A small shared helper
(`computeFiltered(draftText): string[]`) used by both call sites would remove the
duplication and the (currently theoretical) risk of the two filters silently drifting out
of sync in a future edit. Not required for this PR — the current duplication is small,
correct, and covered by tests.

### Verdict rationale

No blocking findings. Scope matches the ticket and the approved plan precisely, the
explicitly-required `text-input.tsx` non-touch held, all tests/lint/typecheck/build are
green, and the two non-blocking notes above (stale `aria-activedescendant` after blur;
exact-match chip removal assuming no duplicate `value` entries) are real but low-risk edge
cases outside the plan's stated test scope, not requested-but-missing behavior.

VERDICT: APPROVED
