# review-notes-tests

## reviewer-tests — round 1

Reviewed `git show 85e49eb` (also equals `git diff main...feat/design-consistency-theme-tokens`)
against `plan.md`'s edge case list (§3) and `ticket.md`/issue #20. Ran the full suite as a
baseline (`npm run test -w apps/web` → 26 files, 329 tests, all passing) and did one targeted
mutation check (details below).

### Blocking

**1. `RootRoute`'s `activeOptions={{ exact: true }}` fix has zero test coverage, and the
suite doesn't catch its regression.** `plan.md` §3 names this exact bug explicitly as "a
concrete, foreseeable bug in this ticket's own new code, not just a hypothetical" — a bare
`<Link to="/" activeProps={...}>` without `activeOptions={{ exact: true }}` is active-matched
on every route (including `/calendar`) because TanStack Router's default `activeOptions` is
prefix-based. The implementer's diff adds the fix correctly
(`apps/web/src/routes/root-route.tsx`) but ships no test for it, and `plan.md` itself only
called a test for this "not required, but if one is added, it should assert..." — leaving it
as an implementer judgment call rather than a hard requirement.

I verified this is a real, silent gap, not a theoretical one: there is no `root-route.test.tsx`
(confirmed via `find`/`grep` — none existed before this commit, and this commit doesn't add
one), and no other test in the suite renders `RootRoute` or navigates the real `router`
export. To confirm the fix itself is unguarded, I temporarily stripped
`activeOptions={{ exact: true }}` from `root-route.tsx` (reverting to the pre-fix, buggy
behavior) and reran the full suite: **all 329 tests still passed** — nothing in the existing
suite would catch this regression if it were silently reintroduced in a future edit (e.g. a
later refactor of the nav that drops the prop without realizing why it's there). I then
restored the file; the working tree is clean.

This is exactly the class of change `AGENT_RULES.md`'s review guidance and the ticket's own
setup call out as risky: a one-line, easy-to-drop prop whose absence produces a real, visible
bug (wrong nav item highlighted) with no compiler or lint signal, on a shared file
(`RootRoute` renders on every route) that had *no* pre-existing test coverage to begin with —
so this isn't "an edge case a broader existing suite already indirectly covers," it's genuinely
zero coverage on the shell that wraps every page. Writing the test is low-cost given what's
already in the repo: `apps/web/src/router.ts` exports a ready-to-use `router` (the same
instance `main.tsx` passes to `RouterProvider`), so a test can do
`router.navigate({ to: "/calendar" })` then `render(<RouterProvider router={router} />)` (or
equivalent, e.g. asserting on `/` too) and check the Tasks link doesn't carry the active class
while on `/calendar` and does on `/` — satisfying `plan.md`'s own edge-case note that such a
test "must render inside the app's actual router config ... not a bare
`render(<RootRoute />)`." No existing test pattern in the repo does this yet (`tasks-page.test.tsx`/
`calendar-page.test.tsx` render page components directly, not through the router), but nothing
blocks writing it — `main.tsx`'s own usage is the pattern to follow.

Recommend: add a `root-route.test.tsx` asserting (a) the Tasks link is active on `/` and not
active on `/calendar`, and (b) the Calendar link is active on `/calendar` and not active on `/`,
rendered through the real `router` export (or an equivalent memory-history router config), per
`plan.md`'s own prescription for what such a test should look like if written.

### Non-blocking

**2. `components/ui/README.md` changes are correctly untested — no disagreement.** Pure
documentation (naming/explaining an already-existing, already-consistent convention across
`Modal`/`Select`/`CalendarPopup`/`TagInput`); `plan.md` §2.1 explicitly states no code changes
to those components, and none appear in the diff. Nothing testable changed.

**3. FullCalendar `--fc-*` CSS custom property overrides (`index.css`) are correctly
untested.** `plan.md` §3 calls this out directly: `calendar-page.test.tsx` mocks
`@fullcalendar/react` entirely (`vi.mock` renders a plain `data-testid="fullcalendar-mock"`
div), so no test in this suite exercises real FullCalendar DOM/CSS, and jsdom wouldn't apply
external stylesheet custom-property cascades in a meaningful way even if it did. Writing a
test that asserts a computed `--fc-*` value would be brittle and wouldn't actually validate
anything visual. Agree with the implementer/plan's "visual-only check" call here.

**4. `CalendarPage` wrapped in `Section` — no new test needed, confirmed.** Diffed
`calendar-page.tsx`: only the wrapping element changed (`<>` → `<Section title="Calendar">`),
loading/error/drag-error paragraphs and the `FullCalendar` element are unchanged as children.
`calendar-page.test.tsx` itself is untouched by this commit and its existing
`screen.getByText`/`findByText` queries for those paragraphs still pass (confirmed via the
329/329 baseline run) — `Section`'s own rendering behavior is independently covered by
`section.test.tsx`. Consistent with `plan.md` §3's explicit reasoning for why no new assertion
is needed here.

**5. `RootRoute`'s outer page container (`mx-auto max-w-3xl space-y-8 p-8`) — no test, and
that's reasonable.** Pure layout/spacing class addition with no conditional logic or branching
behavior to regress (unlike the active-link matching, which has an actual bug/no-bug fork).
`tasks-page.test.tsx`/`calendar-page.test.tsx` render their page components directly, not
through `RootRoute`, so this change doesn't affect them (confirmed by reading both files) and
the 329/329 baseline run reflects that. Low risk, no meaningful test to write without full
router/e2e scaffolding.

### Verdict rationale

Everything except finding 1 is exactly the "docs/CSS/styling-only" category the implementer
described, and the plan itself pre-analyzed why those specific pieces don't need tests. Finding
1 is different in kind: it's a conditional, branching piece of runtime logic
(`activeOptions={{ exact: true }}`) fixing a real, previously-nonexistent-but-foreseeable bug,
on a file with no prior test coverage at all, and I confirmed empirically that the current
suite doesn't guard it. That's a genuinely risky, currently-uncovered edge case, not a trivial
or indirectly-covered one — treating it as blocking per the review brief's own bar for that
distinction.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

Scoped to `git show e9c9266` ("Add nav active-link test coverage for RootRoute"), the only
commit since round 1 — per `AGENT_RULES.md`'s re-review guidance, not a full re-audit. This
commit adds `apps/web/src/routes/root-route.test.tsx` (85 lines, no other file touched).

### Independent verification of the orchestrator's claim

The orchestrator's context states the originally-hunted bug (bare `Link to="/"` active-matching
on every route, including `/calendar`, absent `activeOptions={{ exact: true }}`) doesn't actually
reproduce against the installed TanStack Router version, because `removeTrailingSlash("/")`
preserves the single `/` character rather than stripping it to `""`. I verified this two ways,
independently of the orchestrator's own check:

1. **Read the source directly.** `node_modules/@tanstack/react-router/dist/esm/link.js:80-90`
   (installed version `1.170.18`/`router-core@1.171.15`) — the non-exact branch is:
   ```
   const currentPathSplit = removeTrailingSlash(currentLocation.pathname, router.basepath);
   const nextPathSplit = removeTrailingSlash(next.pathname, router.basepath);
   if (!(currentPathSplit.startsWith(nextPathSplit) && (currentPathSplit.length === nextPathSplit.length || currentPathSplit[nextPathSplit.length] === "/"))) return false;
   ```
   and `path.js`'s `removeTrailingSlash`: `if (value?.endsWith("/") && value !== "/" && ...) return value.slice(0, -1); return value;` — explicitly special-cases `value === "/"` to leave it untouched. For `next.pathname = "/"`, `nextPathSplit = "/"` (length 1, not `""`). For `currentLocation.pathname = "/calendar"`, `currentPathSplit = "/calendar"`. The boundary check requires `currentPathSplit[1] === "/"`, but `"/calendar"[1] === "c"` — so the condition is false and `isActive` returns `false` regardless of `exact`. This holds generally for any route whose second character isn't `/`, not just `/calendar` specifically, so it's not a narrow coincidence of this route tree.
2. **Reran the empirical check myself**, independently of the orchestrator's report (per
   AGENT_RULES's "one reviewer reproducing it once is enough" — but I didn't want to just trust a
   second-hand account of a bash session I couldn't see): stripped
   `activeOptions={{ exact: true }}` from `root-route.tsx`, ran
   `npm run --workspace apps/web test -- root-route.test.tsx` → **2 passed / 2 passed**, restored
   the file, reran the same test with the fix restored → 2 passed / 2 passed again. Did this
   twice total across the round (the first pass collided with `reviewer-code`'s own concurrent
   strip-and-rerun check on the same working tree, transiently leaving the file in a stripped
   state and briefly dropping this ticket directory from disk — resolved via `git checkout --`
   on the code file and rewriting this entry; final state confirmed clean both times:
   `activeOptions={{ exact: true }}` present in `root-route.tsx`, `git status` clean).

Both checks agree with the orchestrator's claim. It's accurate: `exact: true` is not currently
load-bearing against a reproducing bug on this route tree with the installed router version, it's
a defensive/future-proofing choice (search-param matching pins to exact equality instead of
`deepEqual(..., { partial: true })`, confirmed by the same source read, lines 91-99).

### Findings

**Non-blocking — comment accuracy, confirmed correct.** The new file's header comment
(`root-route.test.tsx:10-17`) states `exact: true` is set "defensively" because "TanStack Router's
segment-boundary path matching already keeps it from activating on `/calendar` without it," and
separately explains the real reason to keep it (pinning search-param matching for if `/` ever
gains query params). This matches what I verified above — it doesn't overclaim regression coverage
for a bug that doesn't reproduce, and doesn't misrepresent what the test does or doesn't guard.
Good-faith, accurate comment; no correction needed.

**Non-blocking — test file is still worth keeping, despite not being a true regression test for
the originally-hunted bug.** Before this commit, `RootRoute` (the shell every route renders
inside) had zero test coverage of any kind. This file now provides real coverage of nav
active/inactive link state in general: both tests render through the actual `router` export (not
a bare `render(<RootRoute />)`, satisfying `plan.md` §3's own requirement for this), assert on
literal DOM (`toHaveClass("border-accent")` / `not.toHaveClass(...)`) rather than mock-call
assertions, and exercise both directions (Tasks active on `/`, Calendar inactive; and the reverse
on `/calendar`). I confirmed this coverage is real, not vacuous, by checking it fails when the
underlying mechanism is actually broken: temporarily deleting `activeProps`/`inactiveProps` from
the `to="/calendar"` `Link` (a mutation unrelated to the `exact: true` question, but one this test
suite should catch) makes the second test fail as expected (`calendarLink` never gains
`border-accent`) — reverted after confirming. So while it can't (and, per the corrected comment,
doesn't claim to) catch a regression of `exact: true` being dropped, it does catch a regression of
the active-link mechanism itself breaking, which is real, previously-nonexistent, non-trivial
coverage on a file every route depends on. Keeping it is the right call.

**Non-blocking — the round-1 blocking finding is not really "resolved" in the sense the fixer's
commit message implies, but that's a wording nit, not a functional problem.** The commit message
("Addresses reviewer-tests' blocking finding that the exact:true fix ... had no regression
coverage") is technically true (the finding was "write a test for the nav active-link behavior,"
and one now exists) but could read as implying the test guards the specific `exact: true` gotcha,
which round 1 assumed was a live bug and this round found isn't. Not asking for a commit-message
edit (commit history isn't something reviewer-tests edits or should ask to rewrite after the fact),
just flagging for the record so a future reader of `git log` isn't misled the way round 1 was —
the test file's own comment is the actual source of truth here and it's accurate.

### Targeted check reruns

- `npm run --workspace apps/web test -- root-route.test.tsx` → 2 passed / 2 passed (both with the
  fix in place, confirmed above).
- `npm run --workspace apps/web lint` → clean, no output.
- `gh pr checks 49` → `build` check passing.

### Verdict rationale

Round 1's sole blocking finding was "no test exists for the nav active-link behavior at all." One
now exists, is well-scoped, renders through the real router per the plan's own requirement, and
asserts real DOM state rather than mocks. The fact that the specific bug hunted in round 1 turns
out not to reproduce on this router version doesn't undo the value of the coverage added — the
`RootRoute` shell went from zero coverage to real coverage of its one piece of conditional logic,
and the file is honest about what it does and doesn't guard. No new blocking finding from this
round's diff.

VERDICT: APPROVED
