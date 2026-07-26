## reviewer-tests — round 1

Reviewed `git diff main...feat/component-library-setup` (commit `6b8de04`, PR #22),
`apps/web/src/components/ui/button.test.tsx` and
`apps/web/src/routes/ui-demo-page.test.tsx`, against `plan.md` §3.3/§3.4/§5 and
`ticket.md` (GitHub issue #14).

### Verification performed (not just static reading)

- Ran `npm run test -w apps/web`: 3 files, 16 tests, all passing on the branch as-is.
- Mutation-tested the actual assertions (not just "does it run") by temporarily editing
  `button.tsx` / `ui-demo-page.tsx` on disk, rerunning the suite, then restoring the
  originals via `git status`-verified clean revert:
  - Changed the default `variant` from `"primary"` to `"secondary"` →
    `renders the documented defaults` test failed as expected (caught the regression).
  - Destructured `disabled` out of the props passed to props spread (simulating a bug
    where `disabled` stops reaching the native `<button>`) →
    `respects the disabled prop and does not fire onClick when disabled` failed as
    expected (`toBeDisabled()` assertion caught it).
  - Dropped the `"sm"` size from `UiDemoPage`'s rendered sizes list (simulating a
    component added to `components/ui/` without being fully wired into the demo route) →
    two `UiDemoPage` tests failed as expected (`getByText` threw).
  - All three mutations produced test failures; reverting them restored a clean 16/16
    pass. This confirms the tests are exercising real behavior, not just rendering
    without assertions or asserting mocks were called.

### Coverage vs. plan.md §5's edge case list

All five plan-mandated behaviors are present and each is a real assertion, not a mock
check:
- Variant × size combinations (`primary`/`secondary` × `sm`/`md`, all 4 combos) — render
  + `getByRole` name assertion.
- `disabled` blocks `onClick` — `toBeDisabled()` + `fireEvent.click` + `not.toHaveBeenCalled()`.
- `onClick` fires as expected — `toHaveBeenCalledTimes(1)`.
- Defaults render as documented — asserted via `className` containing `bg-blue-600`
  (primary) and `px-4` (md). Note: this is a narrow, deliberate use of asserting on
  literal Tailwind class fragments, which plan §3.3 says to generally avoid ("brittle,
  low value"). It's justified here because default resolution has no other observable
  DOM signal (no text/aria difference between variants), but it does mean this test can
  break for a reason unrelated to default-resolution (e.g. a future rename of
  `bg-blue-600` to a different shade during a real theming pass) — non-blocking, just
  flagging so a future maintainer doesn't mistake a spurious failure here for a
  default-prop regression.
- `UiDemoPage` renders standalone with no router/query/tRPC context — confirmed genuine:
  `apps/web/src/vitest-setup.ts` registers no global providers, so
  `expect(() => render(<UiDemoPage />)).not.toThrow()` is a real test of "doesn't need
  context," not a tautology dressed up by ambient test-harness providers.

### Gaps (non-blocking)

- `root-route.tsx`'s new dev-only `<Link to="/dev/ui">` (added in this diff) has zero
  test coverage — no `root-route.test.tsx` exists on either side of the diff. This is a
  genuine behavior change in the diff with no test at all. Judged non-blocking: it's a
  single conditional `<Link>` gated on `import.meta.env.DEV`, plan.md's own edge-case list
  (§5) doesn't call for a test here, and the failure mode (a dead/wrong link) is low
  severity and would be caught immediately by manual use of the demo route per the
  ticket's own "for visual review" framing.
- `router.ts`'s `import.meta.env.DEV` conditional route registration is untested at the
  unit level — but plan.md §5 explicitly designates this a "manual/CI-level check" via
  the existing `build` step, not a planned automated test, so this is not a gap versus
  the plan (confirmed reviewer-code's notes already verified the prod bundle excludes
  `/dev/ui` by grepping the build output).

### Test quality notes

- No snapshot tests, no assertions that only check a mock was called without also
  checking the resulting DOM state (the one `vi.fn()` usage, `onClick`, is paired with a
  real DOM interaction via `fireEvent.click`).
- `afterEach(cleanup)` present in both suites — no cross-test DOM leakage observed.
- Test file organization (loop over variant/size combinations rather than one
  monolithic test) makes it easy to see exactly which combination would fail, which
  matters given plan §5's requirement that every combination render "without throwing."

VERDICT: APPROVED
