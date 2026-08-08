# review-notes-code

## reviewer-code — round 1

Reviewed `git show 85e49eb` (equals `git diff main...feat/design-consistency-theme-tokens`)
against `ticket.md` (issue #20), `plan.md`, and `refiner-notes.md`'s round-1/round-2
back-and-forth. Ran the actual build/test suite rather than trusting the diff on paper:

- `gh pr checks 49` → CI's `build` job (lint + typecheck + test + build) already green.
- `npx vitest run src/routes/calendar-page.test.tsx src/components/ui/section.test.tsx` →
  20/20 passing.
- `npm run build -w apps/web` → succeeds; inspected the compiled CSS output directly and
  confirmed the `.fc` block compiles as expected, including Lightning CSS's automatic
  `color-mix()` fallback (`--fc-today-bg-color:#3d6a7226` as a pre-computed fallback ahead
  of the `color-mix(...)` progressive-enhancement declaration) — no browser-support gap.
- Confirmed via `node_modules/@tanstack/react-router/dist/esm/link.d.ts` that
  `activeProps`/`inactiveProps` are real, typed `Link` props (matches refiner round 2's
  independent verification against the router's runtime source).

### Scope fidelity

`git diff --stat` shows exactly 4 files touched: `components/ui/README.md`, `index.css`,
`calendar-page.tsx`, `root-route.tsx` — matches the plan's task breakdown 1:1, no drive-by
changes. Cross-checked every explicit "not doing" item from plan.md §4:

- **No `@theme` value change.** The new `.fc` block and font-family rule sit *outside* the
  `@theme {}` block in `index.css` and only reference existing tokens via `var(--color-*)`/
  `var(--font-mono)` — confirmed by reading the full file, not just the diff hunk.
- **No animation tokens ported** (`--animate-checkmark-pop`/`--animate-ring-ping`) — absent
  from the diff, `task-list-item.tsx` untouched.
- **No full FullCalendar re-skin** — the CSS block is bounded to `--fc-border-color`,
  `--fc-page-bg-color`, `--fc-neutral-bg-color`, `--fc-today-bg-color`, and toolbar
  title/button font-family, matching plan §2.2's bounded list almost exactly (a superset
  of one extra var, `--fc-neutral-bg-color`, which is a reasonable/expected pairing with
  `--fc-page-bg-color` and still within "border/background/font mismatch," not scope
  creep).
- **No new lint tooling** — no `eslint.config.*`/`package.json` changes in the diff.
- **No `explore/page-design` edits** — confirmed untouched (only read from, via `git show
  explore/page-design:...`).

### Refiner-flagged gaps — both genuinely resolved, not just claimed

- **Page container**: `root-route.tsx` wraps its entire return value in
  `<main className="mx-auto max-w-3xl space-y-8 p-8">`, byte-for-byte the same class
  string as `explore/page-design`'s `design-explore-page.tsx` root element (diffed both
  directly). `<Outlet />` and the dev-only `/dev/ui` link both live inside it, per plan
  §2.3.
- **Root-path exact-match**: `activeOptions={{ exact: true }}` is present on the `"/"`
  `Link` only, not on `/calendar` (correct — `/calendar` isn't a prefix of any other
  route). This is the one piece of genuinely new interactive logic in the diff and it's
  the specific fix refiner round 2 verified against the installed router's runtime source
  as technically correct (prefix-matching is the default when `activeOptions` is
  omitted).

### README family-count consistency (refiner round 2's non-blocking flag) — fixed correctly

Refiner round 2 flagged that adding "floating-overlay" as *the* third family would collide
with a pre-existing, untouched line calling `shadow-input` "a third family." Diffed the
implemented README: the "Card/Panel vs. Button vs. floating overlay" section is now
consistently "three visual families" throughout (heading, prose, "Corners" cross-reference,
"Portal + focus-trap" cross-reference), and the `shadow-input` mention was reworded to "a
fourth, unrelated family" — resolving the collision the refiner predicted. Grepped the full
file for every remaining "two"/"three"/"second"/"fourth" occurrence and manually checked
each one in context; no stale "two families"/mislabeled count survives anywhere in the
file (the two "two"/"second" hits that remain — "the two families" on line 46 referring to
Button-vs-floating-overlay specifically, and "future second overlay layer" on line 177
referring to z-index stacking, not family count — are both correct uses, not leftover
drift).

### Design / correctness

- `CalendarPage`'s `<Section title="Calendar">` wrap matches `TasksPage`'s existing
  `<Section title="Tasks">` pattern exactly (same import path, same usage shape); loading/
  error/drag-error `<p>` tags and the `FullCalendar` element remain unchanged children, so
  existing test coverage keeps validating the same render shape (confirmed by running the
  test file — still 100% passing, no update needed, matching plan §3's prediction).
- `RootRoute`'s new markup reuses only pre-existing tokens (`border-ink`, `accent`,
  default `font-mono`) — no ad hoc hex/arbitrary values introduced.

### Non-blocking

**1. Nav `gap` differs slightly from the mockup.** `root-route.tsx`'s new `<nav>` uses
`gap-4`; `explore/page-design`'s mockup nav uses `gap-2`. Trivial spacing delta (mockup:
`<nav className="flex gap-2 text-sm">`; implementation: `<nav className="flex gap-4
text-sm">`), and `gap-4` also happens to match the pre-existing (pre-ticket) nav's gap
value, so this reads as an intentional "keep the existing gap, adopt the mockup's other
styling" choice rather than an oversight — flagging only because the ticket's own framing
("look closely at details" against the mockup) makes even a one-token pixel delta worth
naming. Not a functional or visual-language issue; doesn't warrant a fix round on its own.

**2. Missing test coverage for the `activeOptions={{ exact: true }}` fix** — already
flagged as blocking in `review-notes-tests.md` (reviewer-tests' domain per
`AGENT_RULES.md`'s division of responsibility). Noting here only for completeness: the
*code* itself is correct (verified above and by refiner round 2 against router source), so
this doesn't affect my own verdict, but a fix round addressing reviewer-tests' finding
should not touch `root-route.tsx`'s actual logic — only add a test.

### Verdict rationale

Every plan.md task item, every plan.md §4 scope-boundary item, and both refiner-flagged
gaps were checked against the actual diff (not the implementer's summary) and hold up.
Build, targeted tests, and CI are all green. No logic errors, no unhandled edge case, no
scope creep, no unrequested abstraction. The two non-blocking notes above are cosmetic/
informational, not defects.

VERDICT: APPROVED

## reviewer-code — round 2

Scope: `git show e9c9266` only (per round-2 instructions) — the new
`apps/web/src/routes/root-route.test.tsx`, added to address reviewer-tests' round-1
blocking finding (no coverage for the `activeOptions={{ exact: true }}` change on the
"/" nav `Link` in `root-route.tsx`).

**1. Verified the "doesn't actually reproduce" claim independently.** Read
`node_modules/@tanstack/react-router/dist/esm/link.js`'s `isActive` computation
directly (not just `path.js`'s `removeTrailingSlash`): for non-exact matching it does

```js
const currentPathSplit = removeTrailingSlash(currentLocation.pathname, router.basepath);
const nextPathSplit = removeTrailingSlash(next.pathname, router.basepath);
if (!(currentPathSplit.startsWith(nextPathSplit) && (currentPathSplit.length === nextPathSplit.length || currentPathSplit[nextPathSplit.length] === "/"))) return false;
```

For the "/" link, `nextPathSplit` is `"/"` itself (length 1, `removeTrailingSlash`
special-cases `value === "/"` to not strip it). On `/calendar`,
`currentPathSplit[1]` is `"c"`, not `"/"`, and lengths differ, so the boundary check
fails and `isActive` is `false` regardless of `exact`. This only "accidentally" works
because the root path's own trailing-slash-stripped form is `"/"` — for a non-root
prefix link (e.g. `to="/foo"` vs. current path `/foobar`) the analogous bug *would*
reproduce, but that's not what's on this route tree, and the ticket's fix was scoped to
the concrete "/" vs. "/calendar" pair. I confirmed empirically too: temporarily deleted
`activeOptions={{ exact: true }}` from `root-route.tsx` and ran
`npx vitest run src/routes/root-route.test.tsx` twice — both runs passed 2/2 — then
reverted with `git checkout --`. Matches the orchestrator's own empirical check.
The reasoning holds; this isn't overclaiming.

**2. Test file comment (lines 10-17) is accurate, not overclaiming.** It states the
`exact: true` is defensive (segment-boundary matching already prevents the bug) and
explains *why* `exact: true` still matters (pins search-param matching for a
hypothetical future `/` with query params) rather than asserting the test catches a
live regression. This is honest and matches AGENT_RULES.md's comment guidance (why, not
narration) — no correction needed. Non-blocking, just confirming it's fine.

**3. Test structure and design are sound, consistent with existing patterns.**
`renderApp()`'s `QueryClientProvider`/`TRPCProvider`/`jsonResponse` shape mirrors
`tasks-page.test.tsx`, `calendar-page.test.tsx`, etc. almost line-for-line (same
`afterEach(() => { cleanup(); vi.restoreAllMocks(); })`, same batched-fetch stub
pattern generalized to answer any procedure names rather than hardcoding
`tasks.list`/`tags.list`). No copy-paste inconsistency, no new abstraction introduced.
Rendering through the app's real singleton `router` export (not a bare
`render(<RootRoute />)`) is the correct choice here since `Link`'s active-state hook
needs a real router context — a shallow render wouldn't exercise the code path under
test at all.

**4. No scope creep.** Diff is exactly one new test file, 85 lines, nothing else
touched. `git diff --stat 85e49eb..e9c9266` confirms.

**5. Verified it runs clean.** `npx vitest run src/routes/root-route.test.tsx` → 2/2
pass. Full suite `npx vitest run` in `apps/web` → 27 files / 331 tests pass (no
leakage from reusing the singleton `router` across the two `it` blocks — `cleanup()`
between tests unmounts the previous `RouterProvider` tree before the next
`router.navigate()` + render). `npx eslint src/routes/root-route.test.tsx` and
`npx tsc -b --noEmit` both clean.

No blocking or non-blocking findings on this commit. Round 1's approval stands.

VERDICT: APPROVED
