# Plan: Design consistency pass — consolidate Tailwind theme tokens (issue #20)

Issue #20's full text (fetched via `gh issue view 20`):

> Theme/design choices land incrementally with the component and feature tickets that
> need them (see AGENT_RULES.md) — this is not a ticket to build a custom theme upfront
> or replace Tailwind's defaults in one go.
>
> Once several component tickets (#15-#19) have each extended the Tailwind theme
> piecemeal as they needed (colors, spacing, radii, etc.), do a consolidation pass:
> review what's accumulated, check for drift/inconsistency between tickets that each
> picked values independently without seeing the whole, and tidy the theme config into a
> coherent set rather than a pile of one-off additions.
>
> Not urgent — revisit once there's real accumulated theme usage to consolidate, not
> before.
>
> Check this specifically against the try out design run we did on branch
> `explore/page-design` — that branch was sort of the expectation we had for the result
> of having the different components built out. Look closely at details.

## 0. Investigation performed before writing this plan

Read the current `@theme` block (`apps/web/src/index.css`), every file under
`apps/web/src/components/ui/`, `apps/web/src/components/ui/README.md`, the two page
routes that consume the component library (`tasks-page.tsx`, `calendar-page.tsx`,
`root-route.tsx`), `apps/web/src/main.tsx`, `apps/web/src/router.ts`, and
`tickets/calendar-view/plan.md` (the ticket that most directly flagged a deferred
styling risk). Diffed `main...explore/page-design` (`apps/web/src/index.css`,
`apps/web/src/routes/design-explore-page.tsx`, `apps/web/src/components/ui/button.tsx`)
to see what that branch actually prototyped, and grepped every `ui/*.tsx` file for
hardcoded hex colors, arbitrary Tailwind values (`[...]`), and off-palette default
Tailwind color classes (`gray-*`, `blue-*`, etc.) to find one-off values that bypass the
shared tokens.

**Headline finding: the raw `@theme` token block itself is not actually drifted.** There
is no hardcoded hex color, no arbitrary shadow/color value, and no default-Tailwind-color
usage anywhere in `components/ui/*.tsx` outside `index.css` — every component already
references `ink`/`paper`/`line`/`accent`/`accent-dark`/`pop` and
`shadow-hard`/`shadow-float`/`shadow-input` by name. Spacing and radii were never
custom-extended at all (`AGENT_RULES.md` only requires extending the theme "as needed";
no ticket has needed a spacing/radius token beyond Tailwind's default scale), so there's
no spacing/radius drift to reconcile either. In other words, the literal token *values*
in `index.css` are already coherent — the drift this ticket needs to fix lives one layer
up: in (a) an undocumented third convention that three separate tickets each
independently reinvented, (b) the page-level surfaces (including the outermost page
container, not just the nav) that were never brought into the design language at all, and
(c) the resulting inaccuracy in `components/ui/README.md`, which is the "coherent set"
doc this issue asks for. Concrete findings, in the order this plan addresses them:

1. **`components/ui/README.md`'s "Card/Panel vs. Button" section documents only two
   shadow/radius families, but the codebase has grown a third that no one wrote down.**
   The README states the choice as binary: `shadow-hard`+`rounded-sm` for
   pressable controls (`Button`), `shadow-float`+`rounded-none` for "a floating content
   container" (`Card`/`Panel`). But three separately-merged tickets — `tag-input-badge`
   (#36, `TagInput`'s suggestion dropdown), `select-datepicker-refactor` (#40, `Select`'s
   listbox and `CalendarPopup`'s month grid), and `feedback-components` (#38, `Modal`) —
   each independently reached for `shadow-hard`+`rounded-sm`+`border-2 border-ink` for a
   *floating overlay panel*, not a pressable control. They're mutually consistent with
   each other (same shadow, same radius, same border treatment, `z-10` for the two
   dropdowns vs. `z-50` for `Modal`, already coherently layered per the README's own
   z-index note) — so there's no visual bug to fix — but the README's "Card/Panel vs.
   Button" section never names `Modal` (or `Select`'s listbox, `CalendarPopup`,
   `TagInput`) at all: it's a coverage gap, not an explicit misstatement. The doc simply
   stops at two families and leaves the third undocumented, so a reader has no way to
   know `Modal`'s (and the three others') `shadow-hard`+`rounded-sm` choice is an
   established, agreed-upon convention rather than an unreviewed one-off. The next ticket
   that adds another overlay (the README's own example: "a future second overlay layer
   (toast, nested modal)") has nothing accurate to read before picking a treatment. This
   is exactly the "picked values independently without seeing the whole" drift the issue
   calls out, just surfaced as a documentation gap rather than a value conflict.
2. **`CalendarPage` (`apps/web/src/routes/calendar-page.tsx`) applies zero theme tokens.**
   FullCalendar renders with its own unstyled defaults (default font, default blue accent,
   Material-ish buttons) — a visible, page-level mismatch against the
   monospace/border-first/muted-palette language every other route uses. This isn't an
   oversight this plan is inventing: `tickets/calendar-view/plan.md` §3.7 explicitly
   flagged "Tailwind preflight vs. FullCalendar's `<table>`-based grid" as a "flagged
   risk, not pre-solved" and deferred any `--fc-*` CSS override to a follow-up if the grid
   "does look broken" — that follow-up never happened. Separately, `CalendarPage` doesn't
   wrap its content in `Section` the way `TasksPage` does (`<Section title="Tasks">`),
   so the calendar route also lacks the page-heading treatment every other route has.
3. **`RootRoute` (`apps/web/src/routes/root-route.tsx`) — the page shell present on every
   route — has never been styled, and that gap is bigger than just the nav.** It's
   unchanged since the original scaffold plus two `<Link>` additions; a plain
   `<nav className="flex gap-4">` with default-styled links, no border, no monospace
   treatment, no active-route indication, and `<Outlet />` rendered with no wrapping
   container at all. `explore/page-design`'s mockup (`design-explore-page.tsx`) shows both
   pieces of this themed: a `<header className="... border-b-2 border-ink pb-4">` with a
   bold monospace title and a `<nav>` whose active item gets `border-b-2 border-accent`
   — **and** that header/nav plus all page content sits *inside* the mockup's root
   element, `<main className="mx-auto max-w-3xl space-y-8 p-8">`, a centered, padded,
   max-width page container. Checked every real render path to confirm nothing already
   provides this: `main.tsx` renders `RouterProvider` with no wrapping container;
   `RootRoute` has none; `TasksPage`/`CalendarPage` have none; `Section`'s own
   `baseClasses` is just `"space-y-3"` (no padding/max-width). So today every real page
   renders content flush to the browser edge — arguably as visible a mismatch against the
   mockup as the unstyled nav itself, and by the same logic the nav gap is in scope for
   ("it's the one piece of UI every page shares and no component-library ticket ever
   owned it"): nobody owns this container either, since it isn't part of any
   `components/ui/` component and no page adds it individually. Issue #20 specifically
   asks to check "against branch `explore/page-design`... look closely at details," so
   this plan brings in *both* the header/nav restyle and the outer page container as one
   `RootRoute` change (see §2.3) rather than cherry-picking only the header.
4. **Not found / explicitly ruled out as drift:** no duplicate/conflicting token
   definitions in `@theme`; no hardcoded hex colors or arbitrary shadow values in any
   component; `Card`'s `{sm, md}` padding scale vs. `Panel`'s `{md, lg}` padding scale use
   different label sets but identical underlying Tailwind spacing utilities at the
   overlapping `md` step (`p-4` in both) — a legitimate default-value difference (`Card`'s
   default is more compact than `Panel`'s), not drift, so this plan leaves it alone.

## 1. What "done" means

- `components/ui/README.md`'s shadow/radius section accurately documents all three
  established families (pressable/`Button`, static content container/`Card`+`Panel`,
  floating overlay/`Modal`+`Select`+`CalendarPopup`+`TagInput`) so a future ticket adding
  a new overlay (toast, nested modal — the README's own named example) has a real
  convention to follow instead of re-deriving one. No component code changes needed for
  this part — the four floating-overlay components already agree with each other; only
  the doc was wrong.
- `CalendarPage` picks up the app's font/color/border language via FullCalendar's
  documented `--fc-*` CSS custom properties (scoped override, not a preflight change —
  matching the exact remedy `tickets/calendar-view/plan.md` §3.7 already pre-approved),
  and wraps its content in `Section` the same way `TasksPage` does, so the two routes
  read as the same app.
- `RootRoute`'s nav shell is themed to match `explore/page-design`'s header/nav mockup
  (bordered header, monospace bold title, active-route indicated with the accent
  underline, root-path link using `activeOptions={{ exact: true }}` so it isn't
  incorrectly shown active on every route) using only already-established tokens
  (`border-ink`, `accent`, `font-mono` is already the body default) — no new tokens
  invented.
- `RootRoute` also wraps its rendered output (header/nav plus `<Outlet />`, plus the
  dev-only `/dev/ui` link) in `explore/page-design`'s outer page container —
  `mx-auto max-w-3xl space-y-8 p-8` — matching the mockup's outermost structural choice,
  not just its header styling, so real pages read as centered and padded like the
  reference instead of flush to the browser edge. Reuses Tailwind's default
  spacing/max-width scale exactly as the mockup does; no new token.
- No change to any token's underlying value in `@theme` — this pass corrects
  *documentation* and *application* of the existing tokens, not the palette/shadow
  values themselves, per the issue's explicit "not a ticket to build a custom theme
  upfront or replace Tailwind's defaults" framing and per `AGENT_RULES.md`'s "extend
  incrementally, not a big theming ticket" rule (this pass isn't the exception to that —
  it's tidying, not redesigning).
- Demo page (`/dev/ui`) and existing component tests are unaffected — this ticket
  touches page-shell/route files and one doc, not `components/ui/*.tsx` component
  implementations (aside from possibly `modal.tsx` if §2.1 below turns up an actual
  need to change it, which investigation suggests it won't).
- CI (`lint`, `typecheck`, `test`, `build`) stays green.

## 2. Task breakdown

### 2.1 Document the floating-overlay family (`components/ui/README.md`)

- Rewrite the "Card/Panel vs. Button — two visual families" section (and its heading) to
  "three visual families," adding the floating-overlay family: `shadow-hard` +
  `rounded-sm` + `border-2 border-ink`, used by `Modal`, `Select`'s listbox,
  `CalendarPopup`'s month grid, and `TagInput`'s suggestion dropdown — content that pops
  up transiently above other content, as distinct from `Card`/`Panel`'s "content
  embedded in the page flow" use of `shadow-float`+`rounded-none`. Explain the
  distinguishing question a future component should ask in three branches, not two:
  pressable control -> `shadow-hard`+`rounded-sm` (`Button` family); content embedded in
  page flow -> `shadow-float`+`rounded-none` (`Card`/`Panel` family); content that pops
  up transiently above other content -> `shadow-hard`+`rounded-sm` (floating-overlay
  family) — note explicitly that the floating-overlay family shares `Button`'s exact
  shadow/radius values but is a semantically distinct group (not pressable), so a reader
  doesn't misread the shared values as the two families actually being one.
- Fill the documentation gap where the existing section never names `Modal`/`Select`/
  `CalendarPopup`/`TagInput` at all (it's a coverage gap, not a contradiction to
  "fix" — see §0 finding 1) — cross-reference the portal/focus-trap `Modal` bullet so the
  two sections agree and a reader can find both descriptions of `Modal`'s styling in one
  coherent place.
- No code changes to `modal.tsx`, `select.tsx`, `calendar-popup.tsx`, or `tag-input.tsx`
  — their existing values are what's being documented, not changed.

### 2.2 Theme `CalendarPage` (`apps/web/src/routes/calendar-page.tsx`, `apps/web/src/index.css`)

- Add a scoped FullCalendar override block to `index.css` (`@layer components`, or a
  clearly-commented plain block right after the existing `field-base` rule — final
  placement decided during implementation, whichever reads better alongside the existing
  `@layer components` comment style) mapping FullCalendar's documented CSS custom
  properties to the existing theme tokens: `--fc-border-color: var(--color-line)`,
  `--fc-page-bg-color`/`--fc-neutral-bg-color: var(--color-paper)`,
  `--fc-today-bg-color` to a low-opacity `accent` tint, and the toolbar
  button/title font to `var(--font-mono)`. Exact property list is finalized against
  FullCalendar v6's actual rendered DOM during implementation (some `--fc-*` vars may not
  visibly matter once set) — the implementer runs the dev server and visually confirms
  per the same one-time-visual-check precedent `tickets/calendar-view/plan.md` §3.7
  already established (not a `reviewer-code` browser check, per `AGENT_RULES.md`'s
  re-review scope rule).
- Only theme tokens already in `@theme` are referenced here — no new custom property is
  added to `@theme` itself; FullCalendar's `--fc-*` variables are FullCalendar's own
  contract, set via a plain CSS rule that reads from `var(--color-*)`, not a Tailwind
  theme extension.
- Wrap `CalendarPage`'s returned content in `<Section title="Calendar">` (matching
  `TasksPage`'s `<Section title="Tasks">`), keeping the existing loading/error/drag-error
  paragraphs and the `FullCalendar` element as `Section`'s children.

### 2.3 Theme `RootRoute` (`apps/web/src/routes/root-route.tsx`)

- Restyle the nav shell to match `explore/page-design`'s header mockup using only
  existing tokens: a `border-b-2 border-ink` header row, a bold monospace app title (body
  font is already `font-mono` by default, so no explicit `font-mono` class needed per
  `README.md`'s "don't add `font-mono` per component" convention), and nav links with
  active-route styling.
- **Add the outer page container** (this is new scope added in this plan's revision —
  see `refiner-notes.md` round 1): wrap `RootRoute`'s entire rendered output — the
  header/nav row, the dev-only `/dev/ui` link, and `<Outlet />` — in
  `explore/page-design`'s root element, `<main className="mx-auto max-w-3xl space-y-8 p-8">`.
  This matches the mockup's outermost structural choice, not just its header/nav styling.
  Today no file in the app applies any page-level max-width/padding (confirmed by reading
  `main.tsx`, every page route, and `Section`), so real pages currently render flush to
  the browser edge; this closes that gap using only Tailwind's default
  `mx-auto`/`max-w-3xl`/`space-y-8`/`p-8` utilities — no new token.
- Active-route indication (`border-b-2 border-accent` on the current route's link, per
  the explore mockup) requires knowing the current path — use TanStack Router's
  `Link`'s built-in `activeProps`/`useMatchRoute` (whichever the installed TanStack
  Router version exposes; confirmed available during implementation) rather than hand
  string-comparing `location.pathname`, since the codebase already depends on TanStack
  Router for routing and shouldn't hand-roll what the router already provides.
- **Root-path exact-match gotcha (must handle, not optional):** the task list route is
  registered at `path: "/"` (`apps/web/src/router.ts`), and TanStack Router's default
  `activeOptions` is prefix-based, not exact-match — a bare
  `<Link to="/" activeProps={...}>` is considered active on *every* route, including
  `/calendar`, because `/` is a prefix of every path. The `"/"` link must pass
  `activeOptions={{ exact: true }}` (or an equivalent exact check if using
  `useMatchRoute`) so "Tasks" is only shown active on the tasks route itself. The
  `/calendar` link doesn't need this (no other route path is a prefix of `/calendar`).
  Repeated as a named edge case in §3 so it isn't lost during implementation.
- The `/dev/ui` dev-only link and its wrapping `{import.meta.env.DEV && ...}` block stay
  functionally as-is, restyled to fit visually (e.g. as a small muted link) rather than
  removed or moved — it's out of scope to redesign the dev-only affordance itself; it
  moves inside the new page container along with everything else `RootRoute` renders, but
  its conditional rendering logic doesn't change.

### 2.4 No `apps/server` changes, no schema changes, no new npm dependency

This is a pure `apps/web` styling/doc consolidation; nothing here touches the API layer,
Prisma schema, or adds a package.

## 3. Edge cases and error conditions

- **`CalendarPage`'s existing loading/error states** (`isLoading`, `isError`,
  `dragError`) must still render correctly once wrapped in `Section` — `Section` renders
  its `title` header plus `children`, so these conditional paragraphs simply become
  `Section` children; verify (existing test coverage, `calendar-page.test.tsx`, already
  queries for this text via `screen.getByText`, and `Section`'s own rendering is already
  covered by `section.test.tsx`, so no new assertion is needed here — this is a
  render-shape change, not new behavior).
- **FullCalendar is mocked in `calendar-page.test.tsx`** (`vi.mock("@fullcalendar/react", ...)`
  renders a plain `<div data-testid="fullcalendar-mock">`), so the `--fc-*` CSS override
  is invisible to that test suite entirely — no test will exercise it. This is expected:
  CSS custom property theming of a third-party widget isn't unit-testable in jsdom, the
  same reasoning `tickets/calendar-view/plan.md` §3.7 already used ("visual-only check
  ... implementer does this once while building"). Call this out plainly rather than
  writing a brittle test that asserts a computed style jsdom doesn't actually apply from
  external CSS.
- **Root-path (`"/"`) link showing active on every route.** Named explicitly because it's
  a concrete, foreseeable bug in this ticket's own new code, not just a hypothetical: per
  TanStack Router's default (non-exact) `activeOptions`, a `Link to="/"` without
  `activeOptions={{ exact: true }}` matches every path as a prefix and would render
  "Tasks" as active on `/calendar` too. If the implementer adds a test for the nav (not
  required, but if one is added), it should assert the tasks link is *not* active while on
  `/calendar` and vice versa, exercised through a real/mock router (see next bullet) —
  a naive "renders active class" test wouldn't catch this class of bug.
- **`RootRoute`'s active-link styling in a router-less test environment.** If any test
  renders `RootRoute` outside a full `RouterProvider` (check existing test setup before
  assuming `activeProps`/`useMatchRoute` works in isolation), the active-state hook may
  need a real/mock router context; confirm during implementation whether `root-route.tsx`
  has any existing tests (investigation found none), and if the implementer adds one, it
  must render inside the app's actual router config or an equivalent test router, not a
  bare `render(<RootRoute />)`.
- **New page container doesn't break existing page-component tests.** `tasks-page.test.tsx`
  and `calendar-page.test.tsx` render `TasksPage`/`CalendarPage` directly (not through
  `RootRoute`/`RouterProvider` — confirmed by reading both files), so wrapping `Outlet` in
  the new `<main>` container inside `RootRoute` doesn't change what those tests render or
  need to assert; no existing test needs updating for this change.
- **`/dev/ui` link visibility** — `import.meta.env.DEV` gating must survive the restyle
  and the new wrapping container; don't accidentally hoist it outside the conditional
  while touching surrounding markup.
- **FullCalendar's own internal light/dark or size-variant states** (e.g. `.fc-day-today`,
  `.fc-event`, `.fc-list-event`) beyond the specific `--fc-*` properties listed in §2.2 —
  only the specific variables needed to fix the border/background/font mismatch are set;
  this plan doesn't attempt to re-skin every FullCalendar element class-by-class (see
  scope boundary below).
- **README accuracy drift going forward**: this plan doesn't add tooling/lint to enforce
  the three-family convention (e.g. no custom ESLint rule scanning for stray
  `shadow-[...]` arbitrary values) — enforcement stays "the next planner/reviewer reads
  the README," matching how the existing two-family convention was (and wasn't, per
  finding #1) enforced.

## 4. Explicitly not doing (scope boundary)

- **Not changing any token's underlying value** in `@theme` (no new/renamed color, no
  new shadow definition, no spacing/radius scale). Investigation found no conflicting or
  duplicated values to reconcile — the accumulated tokens are already internally
  consistent; see §0.
- **Not porting `explore/page-design`'s two extra animation tokens**
  (`--animate-checkmark-pop`, `--animate-ring-ping`) or building the circular
  spring-pop "complete" checkbox interaction they belong to. `components/ui/README.md`
  already documents this as deliberately deferred ("pull patterns from there as the
  tickets that need them come up, rather than re-deciding from scratch") and
  `task-list-item.tsx` currently completes a task via the plain square `Checkbox`. Adding
  that interaction is a new feature/behavior change, not a theme-token consolidation —
  bringing it in here would blur "tidy what's accumulated" into "add a component this
  ticket doesn't own." A future ticket can pull it in when a task-completion-UX ticket
  actually needs it.
- **Not doing a full FullCalendar re-skin.** §2.2 sets a bounded list of `--fc-*`
  properties to close the most visible mismatches (border, background, font); it doesn't
  attempt to reproduce every hard-shadow/border-first detail (e.g. giving every day cell
  a `border-2` treatment) FullCalendar's own DOM structure may not cleanly support
  without much deeper custom CSS. That's a larger, separate visual-polish ticket if
  wanted later, not a token-consolidation pass.
- **Not introducing a lint rule or CI check** to prevent future one-off values (e.g. a
  custom ESLint rule flagging arbitrary Tailwind values or off-palette color classes).
  Worth a future ticket if drift keeps recurring, but out of scope for a first
  consolidation pass per the issue's own "not a ticket to build a custom theme upfront"
  framing.
- **Not touching `Card`'s `{sm, md}` vs. `Panel`'s `{md, lg}` padding-scale naming** —
  investigated (see §0 finding 4) and concluded this is an intentional default-weight
  difference between the two components, not drift.
- **Not merging or altering `explore/page-design`** — read-only reference per the issue
  and per instructions; this branch stays untouched.
- **Not reproducing every remaining visual delta against `design-explore-page.tsx`** —
  e.g. the mockup's task-row hard-shadow card treatment, tag badges, and the `+ new task`
  button placement are `TasksPage`-content-level details, not page-shell/theme-consolidation
  ones; this plan is scoped to the shared shell (`RootRoute`'s header/nav/container) and
  the two flagged page-level gaps (`CalendarPage` theming, README), per §0's investigation
  — not a full pixel-for-pixel reproduction of the mockup's every page.

## 5. Open questions for refiner/reviewers

None outstanding after investigation and this revision — the ambiguous-looking areas
going in (whether `Modal`'s `shadow-hard` choice was a bug to fix vs. an
undocumented-but-correct convention; whether the checkmark-pop/ring-ping animation tokens
belonged in this ticket; and, after round 1, whether the mockup's outer page container and
the root-path active-link gotcha were in scope) all resolved cleanly from evidence already
in the repo (§0 findings 1 and 3, and README's own "pull patterns as needed" language for
the checkbox case), so none is left as a guessed silent decision. If a reviewer disagrees
with the "document, don't change" resolution for the `Modal`/floating-overlay family
(§2.1), the alternative — changing `Modal`/`Select`/`CalendarPopup`/`TagInput` to
`shadow-float`+`rounded-none` instead — is a larger, riskier visual change across four
already-shipped, already-consistent components for a purely documentation-driven reason,
so this plan defaults to fixing the doc rather than the code.
</content>
