# Review notes — tests (layout-primitives, issue #18)

## reviewer-tests — round 1

Scope: `git diff origin/main...feat/layout-primitives` (single commit `175a553`),
checked against `plan.md` §4 and `ticket.md` (issue #18 pointer). Ran the actual test
suite (`npx vitest run` on the four touched test files) and `npx tsc -b --force`, both
green. Additionally verified test sensitivity empirically: for each behavior below
tagged "verified by mutation," I temporarily reverted the corresponding line in the
implementation, reran only the affected test file, confirmed a real failure, then
restored the file from a backup and reran the full suite green again (working tree is
clean, `git status --short` only shows the untracked `tickets/layout-primitives/`
directory).

### Section (`section.tsx` / `section.test.tsx`) — all §4 cases covered, verified genuine

- title+actions, title-only, actions-only, neither: all four present. "Neither" case
  and the fully-empty (`<Section />`) case both assert absence of the
  `.flex.items-center.justify-between` header wrapper via `container.querySelector`,
  not just "doesn't throw" — **verified by mutation**: removing the `hasHeader &&` gate
  makes both of these tests fail with a clear "found <div class=...> instead" error.
- `getByRole("region", { name: "Today" })` for the titled case — **verified by
  mutation**: breaking the `id`/`aria-labelledby` link (removing `id={headingId}` from
  the `<h2>`) makes this test fail with `TestingLibraryElementError: Unable to find
  role="region"`, confirming this assertion genuinely depends on the
  `aria-query`-computed implicit role + accessible-name pairing that `plan-refiner`
  round 2 investigated, not a tautology.
- "no `aria-labelledby` when no title" — **verified by mutation**: forcing
  `aria-labelledby={headingId}` unconditionally makes this fail. Real regression
  coverage, not just documentation of current behavior.
- `className` merge and native-prop forwarding (`data-testid`, `id`) are both asserted
  concretely (`toContain`, `toHaveAttribute`), not just "renders."

### Card (`card.tsx` / `card.test.tsx`) — all §4 cases covered, verified genuine

- `sm`/`md` padding classes, default `md`, `className` merge, zero-children,
  native-prop forwarding all present. **Verified by mutation**: changing the default
  from `"md"` to `"sm"` fails the "defaults to md" test with a clear expected/received
  diff (`p-4` vs `p-3`).

### Panel (`panel.tsx` / `panel.test.tsx`) — all §4 cases covered, verified genuine

- All four title/description presence combinations tested; header-block-absent case
  for "neither" and the fully-empty instance both check for absence of `.border-b-2`.
- `role="region"` + accessible name when titled, and explicitly *no* region role when
  only `description` is given (not just omitted from testing) — both present.
  **Verified by mutation**: forcing `role={undefined}` unconditionally (simulating a
  dev accidentally deleting the explicit `role="region"`) makes the "exposes a region
  role" test fail with the same `Unable to find role="region"` error — this confirms
  the test is actually pinning down that `Panel`'s explicit `role` attribute is
  load-bearing (a bare `<div>` has no implicit landmark role, unlike `Section`'s
  `<section>`), i.e. the asymmetry plan.md §2.2/§2.4 calls out as deliberate is real
  regression-tested, not just asserted in prose.
- `md`/`lg` padding classes and `lg` default, `className` merge, native-prop
  forwarding all present and concrete.

### Demo route (`ui-demo-page.tsx` / `.test.tsx`)

- Section block: checks `h2` heading, the actual `region`-role/name pairing end-to-end
  (not remocked — this is an integration-level re-confirmation of the region-role
  behavior through the real demo composition), the actions button, and the untitled
  example's content text.
- Card block: per-padding label + content text checked (matches existing `Button` demo
  test's style — note the existing `Button` block test also doesn't check for a
  `Button` `h2` heading, only per-variant labels, so Card not asserting its own `h2`
  text is consistent with established precedent, not a regression in rigor).
- Panel block: `h2` heading, both `title`-bearing headings (`getAllByRole` length 2),
  the one `description` text, and all three body-text instances (`getAllByText`
  length 3) — this transitively covers rendering of all three documented panel
  variants (title+description/lg, title-only/md, neither), matching plan.md §3.4/§3.5.

### Non-blocking observations

- The Section titled demo example ("title + actions, with Cards as children") is
  described in plan.md §3.4 as "doubling as a visual example of `Section`+`Card`
  composition," but `ui-demo-page.test.tsx` never asserts the actual child text
  ("Task one" / "Task two") that lives inside that composition — it only checks the
  region name and the actions button for that block. Low risk (unit tests for `Card`
  and `Section` independently cover the pieces, and the composition is trivial JSX),
  but it means a future edit that silently drops the `Card` children from that specific
  demo block wouldn't be caught by the demo test, contrary to §3.5's stated intent
  ("catches a future edit to `ui-demo-page.tsx` that silently drops a variant").
  Suggest adding one more assertion (`getByText("Task one")`) in a fix round if this
  ticket goes through one for other reasons — not worth a fix round on its own.
- `plan.md` §2.4 explicitly frames "`Card` gets no landmark role" as an intentional,
  named asymmetry versus `Section`/`Panel`. `card.test.tsx` has no test asserting the
  absence of a `region`/landmark role on `Card`. This isn't in §4's enumerated edge-case
  list (§4's `Card` bullet only calls for padding/className/zero-children/prop-forwarding),
  so it's not a coverage gap against the plan as written, and the current implementation
  correctly has no role logic to regress. Flagging only so a future PR that adds a role
  to `Card` doesn't do so silently — not asking for a test now.
- Several structural assertions (`container.querySelector(".flex.items-center.justify-between")`,
  `.border-b-2`) key off exact literal Tailwind class strings rather than a
  `data-testid` on the header wrapper. This is a reasonable "structural check" per
  plan.md §4's own phrasing, and mutation-testing above confirms it does catch the
  behaviors it's meant to, but it's slightly coupled to the literal class string (an
  unrelated Tailwind refactor of e.g. `justify-between` → `justify-end` on that div
  would spuriously break these tests even with header-visibility logic unchanged). Not
  blocking — no such refactor is in scope here, and this matches the plan's own
  guidance to avoid exhaustive class-string snapshotting elsewhere while still needing
  *some* concrete structural signal for "no header markup."

### What's solid

- Every §4-enumerated edge case for `Section`, `Card`, and `Panel` has a corresponding
  test, and I confirmed by deliberate mutation (not just reading the assertions) that
  the tests for the highest-risk behaviors (conditional `aria-labelledby`, conditional
  header markup, `Panel`'s explicit `role="region"`, default padding) actually fail
  when the underlying behavior regresses — these are not tests that would pass equally
  well against old and new code.
- The `getByRole("region", { name })` assertions are real, not a false sense of
  security: independently confirmed the installed `aria-query@5.3.0` /
  `@testing-library/dom@10.4.1` versions match what `plan-refiner` round 2 verified,
  and mutation-tested both the `Section` (implicit role via accessible name) and
  `Panel` (explicit `role` attribute) code paths to confirm the tests genuinely
  exercise that mechanism rather than a coincidence of jsdom/ARIA defaults.
- Demo-route tests were extended per §3.5 and assert real rendered content for the new
  blocks, consistent with the existing `Button` block's style, not just "renders
  without throwing" (that placeholder-only assertion still exists as its own top-level
  test but is additive, not a replacement for the content assertions).
- No test asserts a mock was called instead of asserting real rendered output —  no
  mocking is used in any of the four touched test files at all (`Card`/`Section`/`Panel`
  are pure presentational components with no side effects to mock).

VERDICT: APPROVED
