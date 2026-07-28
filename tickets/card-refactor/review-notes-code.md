## reviewer-code — round 1

### Verification performed
- `git diff main...feat/card-refactor` — 7 files, 55/-9 lines, matches plan.md's task
  breakdown almost line-for-line.
- Ran `npm run test` (card.test.tsx, panel.test.tsx, button.test.tsx): 32/32 pass.
- Ran `npm run lint --workspace apps/web`: clean.
- Ran `npm run typecheck --workspace apps/web`: clean.
- Ran `npm run build --workspace apps/web`: succeeds, CSS bundle includes the new theme
  token (Tailwind v4 auto-generates `shadow-float` from `--shadow-float`, same mechanism
  as `shadow-hard`/`shadow-input` — no plugin/config change needed, as the plan assumed).
- Modal-risk check (plan §4): confirmed independently via `git show
  main:apps/web/src/components/ui/modal.tsx` (fails — no such path on `main`) and `gh pr
  view 38 --json state,isDraft,mergedAt` (`OPEN`, `isDraft: false`, `mergedAt: null`) —
  PR #38 is still unmerged, so `modal.tsx` correctly doesn't exist on this branch either.
  The implementer took the correct passive-fallback branch of §4's decision tree: no
  `modal.tsx` edit in the diff (matches — there's nothing to edit), and `gh pr view 39`
  confirms the PR body explicitly flags it: "Note: Modal (PR #38,
  feat/feedback-components) was still unmerged at implementation time, so its shared
  base-class string wasn't updated here — fast-follow needed once #38 merges." This
  satisfies plan §4's "if it hasn't merged yet" branch exactly, including the reasoning
  for *why* (not just a bare TODO).
- `grep` for `shadow-hard`/`shadow-float`/`Card`/`Panel` consumers: confirms `Card`/
  `Panel` are only rendered from `ui-demo-page.tsx` (matches plan §3's stated blast
  radius), and `tag-input.tsx`'s dropdown (`~line 174`) is untouched as the plan's §4
  scope-decision calls for.
- Read `ui-demo-page.tsx`: no tight `space-y-*`/gap wrapping around the Card/Panel demo
  sections that the larger `shadow-float` offset would visibly clip against — the
  visual-check edge case in plan §3 doesn't surface an issue, consistent with not seeing
  any spacing tweak in the diff.

### Scope fidelity vs. ticket.md / plan.md
- Matches plan.md's "done" definition (§1) exactly: `Card`/`Panel` → `rounded-none` +
  `shadow-float`, `Button` untouched, new token documented in README, regression tests on
  both sides (Card/Panel gained the new classes and lost the old ones; Button still has
  the old classes and lacks the new one).
- Panel-included-not-just-Card scope call (plan §4) is implemented as decided — no
  unrequested scope beyond that already-justified extension.
- Section, Badge, Checkbox, TagInput, Button's press mechanics, `tailwind-merge`/`clsx`
  — all correctly left untouched per plan §4's explicit out-of-scope list.
- No unrelated files touched (schema, other components, config) — diff is exactly the 7
  files plan.md's task breakdown named.

### Correctness / design
- No issues found. The CSS token addition follows the existing `--shadow-hard`/
  `--shadow-input` pattern exactly (same `@theme` block, same naming convention). The
  `baseClasses` string edits in `card.tsx`/`panel.tsx` are minimal, single-line diffs with
  no API/prop changes, as planned.
- Regression tests are well-targeted: each of Card/Panel asserts the new classes are
  present *and* the old Button-shared classes are absent (guards against a future partial
  revert), and the paired Button test asserts the reverse — exactly the "future edit can't
  silently make them look the same again without a test noticing" guard plan.md called
  for.
- README update accurately reflects the new two-family (three, counting `shadow-input`)
  system and updates both the shadow paragraph and the separately-listed "Corners" bullet
  that referenced the old single `rounded-sm` convention — didn't miss the second
  reference the way a more mechanical find-replace might have.

### Findings
None — no blocking or non-blocking issues found. Implementation is a faithful, minimal,
correctly-scoped realization of the approved plan, including the higher-risk
cross-branch Modal handling in §4.

VERDICT: APPROVED
