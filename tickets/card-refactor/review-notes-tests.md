## reviewer-tests — round 1

### Verification performed
- `git diff main...feat/card-refactor -- apps/web/src/components/ui/card.test.tsx
  apps/web/src/components/ui/panel.test.tsx apps/web/src/components/ui/button.test.tsx`
  — read the three new test cases in full (one each in `card.test.tsx`, `panel.test.tsx`,
  `button.test.tsx`).
- Ran the full suite (`npm run test --workspace=apps/web -- --run`): 199/199 pass, 19
  files.
- **Mutation-tested each regression test against the pre-refactor implementation** (the
  actual bar this review applies, not just "does it pass today"):
  - Reverted `card.tsx`/`panel.tsx`'s `baseClasses` back to
    `"rounded-sm border-2 border-ink bg-paper shadow-hard"` (the literal old string) and
    reran `card.test.tsx`/`panel.test.tsx`: both new tests fail with a clear diff
    (`expected '...rounded-sm...shadow-hard...' to contain 'rounded-none'`). Confirms the
    Card/Panel regression tests actually assert the behavior change, not just something
    that happens to be true today.
  - Reverted the mutation, then flipped it the other way: mutated `button.tsx`'s
    `baseClasses` to `rounded-none`/`shadow-float` (simulating a future edit that
    accidentally makes Button look like Card again) and reran `button.test.tsx`: the new
    paired test fails (`expected '...rounded-none...shadow-float...' to contain
    'rounded-sm'`). Confirms the Button-side guard the plan asked for
    ("a future edit can't silently 'fix' Button and Card back into looking the same
    without a test noticing on either side") actually works in both directions.
  - Reverted both mutations; `git status --short` confirms working tree is clean again
    (only the untracked `tickets/card-refactor/` dir, expected).
- Confirmed the tests check both presence of new classes *and* absence of old ones
  (`.not.toContain`), not just presence — this is what makes them regression tests rather
  than change-detection-only tests; a test that only checked `toContain("rounded-none")`
  would still pass if a future edit re-added `rounded-sm` alongside it via a bad merge.
- Confirmed no false-positive substring risk between `rounded-sm`/`rounded-none` or
  `shadow-hard`/`shadow-float` (none of the four strings is a substring of another), so
  the `toContain`/`not.toContain` pairs can't accidentally pass for the wrong reason.
- `grep`'d `badge.tsx`, `checkbox.tsx`, `tag-input.tsx` to confirm they're untouched (per
  plan §4's explicit out-of-scope list) and none needed a companion regression test —
  none of them shares `Card`/`Panel`'s exact base-class string being changed here, so
  there's no equivalent regression risk on their side.

### Plan.md edge-case coverage
- Plan §2 items 4–6 (the three tests this review was specifically asked to verify): all
  present, all correctly targeted, all confirmed via mutation testing above to actually
  fail on regression. This is the ticket's core, and it's solid.
- Plan §3's other edge cases (current-consumers blast radius, `className` override
  caveat, nested Button-inside-Card clipping, padding untouched) are explicitly scoped in
  the plan as visual/manual checks ("worth a quick look at `/dev/ui`", "worth a visual
  check"), not automated-test requirements — consistent with this being a presentational,
  Tailwind-class-only change where a snapshot/visual check is a reasonable substitute for
  a jsdom assertion (jsdom doesn't compute layout, so a "does shadow-float visually clip"
  test wouldn't catch anything a class-presence assertion doesn't already cover). No gap
  here — nothing in plan.md asked for automated coverage that's missing.
- Plan §4's Modal cross-branch risk: no test expected on this branch (`modal.tsx` doesn't
  exist here, confirmed independently by both reviewers per PR #38 unmerged status) — the
  plan's own decision tree for the "hasn't merged yet" branch calls for a PR-description
  flag, not a test on this branch. Nothing to check here.

### Test quality
- Tests assert real rendered DOM (`element.className`), not mocks — no
  `expect(fn).toHaveBeenCalled()`-style indirection anywhere in this diff. Straightforward
  and appropriately simple for a presentational-class change.
- Test names are descriptive and each one clearly documents its own regression intent
  ("not the Button-shared look" / "distinct from Card/Panel's shadow-float"), which will
  make a future revert-triggered failure self-explanatory without needing to read the
  plan.

### Findings
None — no blocking or non-blocking issues found. The three regression tests do exactly
what plan.md asked for and were independently confirmed (via mutation testing in both
directions) to fail against both the old Card/Panel implementation and a hypothetical
future Button regression.

VERDICT: APPROVED
