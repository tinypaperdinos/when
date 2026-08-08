# Refiner notes: design-consistency-theme-tokens

## Round 1

### Verification of the plan's three headline claims — all hold up against the code

Checked each claim directly rather than trusting the plan's summary:

- **Third shadow/radius family.** Confirmed by grep: `modal.tsx:150`, `calendar-popup.tsx:268`,
  `tag-input.tsx:174`, `select.tsx:233` all use `rounded-sm border-2 border-ink ... shadow-hard`;
  `card.tsx`/`panel.tsx` use `rounded-none border-2 border-ink bg-paper shadow-float`;
  `button.tsx` uses `rounded-sm ... shadow-hard`. `README.md`'s "Card/Panel vs. Button" section
  (lines 29-43) indeed only names two families. z-index layering claim also checks out
  (`z-10` on the three dropdown/popup overlays, `z-50` on `Modal`). The fix (document, don't
  change code) is the right call — real code, real gap, correctly scoped as doc-only.
  One minor overstatement worth a light touch-up: the plan's prose says the README
  "describes Modal as belonging to the 'floating content container' family," but the README
  never names Modal at all in that section — it's a coverage gap (three families exist, doc
  only describes two), not an explicit misstatement about Modal specifically. Doesn't change
  the fix, just tighten the framing when writing the actual README prose in 2.1 so it doesn't
  claim a contradiction that isn't textually there.
- **`CalendarPage` has zero theme styling and no `Section` wrap.** Confirmed by reading
  `apps/web/src/routes/calendar-page.tsx` — plain `<>...</>` with bare `<p>` tags, no
  `Section`, no `--fc-*` overrides in `index.css`. `tickets/calendar-view/plan.md` §3.7
  does explicitly pre-approve exactly this remedy as flagged-but-deferred. Confirmed.
- **`RootRoute` unstyled nav.** Confirmed — `root-route.tsx` is a bare `<nav className="flex gap-4">`
  unchanged since `calendar-view` (#42) added the two `<Link>`s. Confirmed
  `explore/page-design`'s `design-explore-page.tsx` mockup has the header the plan describes:
  `border-b-2 border-ink pb-4`, bold title, `border-b-2 border-accent` on the active nav item,
  `text-ink/60` on inactive ones. Plan's description of the mockup is accurate.

### Real gap: plan cherry-picks the mockup's header/nav but silently drops its page container

`design-explore-page.tsx`'s root element is `<main className="mx-auto max-w-3xl space-y-8 p-8">` —
the header/nav the plan targets in §2.3 is *nested inside* that padded, centered container, not
free-floating. Checked the current app: `main.tsx` renders `RouterProvider` with no wrapping
container, `RootRoute` has none, `TasksPage`/`CalendarPage` have none (`Section`'s own
`baseClasses` is just `"space-y-3"`, no padding/max-width), only the dev-only `ui-demo-page.tsx`
has a `<main>`. So today, every real page renders content flush to the browser edges — arguably
a more visible mismatch against the mockup than the unstyled nav is.

The plan's own reasoning for why `RootRoute` is in scope ("it's the one piece of UI every page
shares and no component-library ticket ever owned it") applies identically to the missing
page-level container — nobody owns it either. The plan doesn't mention this gap anywhere (not
in §0's findings, not in §4's "explicitly not doing" list), so it reads as an oversight rather
than a deliberate scope call. Given the issue's explicit instruction to check against
`explore/page-design` and "look closely at details," this should be an explicit decision either
way: add an equivalent `mx-auto max-w-*` / padded wrapper (likely in `RootRoute`, wrapping
`Outlet`, using only existing spacing scale per the plan's own "no new tokens invented" rule),
or state the reason for leaving it out in §4 if that's the deliberate call. Right now it's
neither — just missing.

### Real gap: TanStack Router's root-path active-link gotcha isn't called out

§2.3 says to use `Link`'s `activeProps`/`useMatchRoute` for the active-route indicator "whichever
the installed TanStack Router version exposes; confirmed available during implementation." Both
exist in the installed version (`^1.170.18`), so that part is fine — but there's a specific,
well-documented pitfall the plan doesn't mention: this app's task list route is registered at
path `"/"` (`router.ts`), and TanStack Router's default `activeOptions` is *not* exact-match — a
`Link to="/"` without `activeOptions={{ exact: true }}` is considered active on every route,
including `/calendar`, because `/` is a prefix of every path. Without calling this out, the
straightforward implementation (`<Link to="/" activeProps={...}>`) will render "Tasks" as visually
active on the calendar page too — exactly the kind of "look closely at details" bug the issue
asks this ticket to catch, happening inside the ticket's own new code. This belongs in §3 (edge
cases) as a named risk, with the fix being `activeOptions={{ exact: true }}` on the `"/"` link
(or an equivalent `data-status`/`useMatchRoute` exact check).

### Scope check: issue #15-#19 mapping and #36/#38/#40 references

Cross-checked with `gh issue list`: #15 = form-primitives, #16 = date-time-picker,
#17 = tag-input-badge, #18 = layout-primitives, #19 = feedback-components — matches the issue's
literal "#15-#19" range. The plan's parenthetical `(#36)`/`(#38)`/`(#40)` next to
`tag-input-badge`/`feedback-components`/`select-datepicker-refactor` are PR numbers (confirmed
against `git log`), not issue numbers, which reads a little confusingly alongside the issue's own
`#15-#19` issue-number range but isn't wrong — just worth the planner double-checking these read
unambiguously as PR refs if this ever surfaces to a human reviewer. Pulling in
`select-datepicker-refactor`/`card-refactor` (issues #30/#29, not literally in the #15-#19 range)
is reasonable — they're refactors of the #15/#16/#18 components and still fall under "accumulated
theme usage," not scope creep.

### Scope boundaries (§4) — reasonable, no objections

Not porting the checkmark-pop/ring-ping animation tokens, not doing a full FullCalendar re-skin,
not touching Card/Panel's padding-scale naming, not adding a lint rule, not merging
`explore/page-design` — all correctly reasoned and consistent with the issue's explicit "not a
ticket to build a custom theme upfront" framing and `AGENT_RULES.md`'s incremental-theming rule.

### Verdict rationale

The plan's core investigation is sound and its three headline findings are all verified against
the actual code and the `explore/page-design` branch — no fabricated findings. But it explicitly
frames itself as checking "against branch `explore/page-design` ... look closely at details" and
then misses the mockup's own outermost structural choice (the padded/centered page container),
while also carrying a concrete, foreseeable bug (root-path active-link matching) in the one bit of
new interactive logic it's introducing. Both are fixable without changing the plan's overall
shape — they belong in §2.3/§3, not a rewrite — but they should be resolved before implementation
starts, not discovered mid-build.

VERDICT: REVISE

## Round 2

Scope: re-verify the two round-1 blocking findings against the actual revised plan.md
text and the real code/branch (not the planner's summary), plus spot-check the "minor
wording tightening" the planner mentioned. Per `AGENT_RULES.md`'s re-review guidance,
this round does not re-derive the three headline findings already confirmed in round 1.

### Finding 1 (page container) — resolved, verified against the actual mockup file

Re-read `design-explore-page.tsx` on `explore/page-design` directly (not just the
planner's description): its root element is exactly
`<main className="mx-auto max-w-3xl space-y-8 p-8">`, confirmed by re-fetching the file.
Plan §2.3 now explicitly adds this as new scope, wraps `RootRoute`'s entire output
(header/nav, dev-only `/dev/ui` link, `<Outlet />`) in the same class string, and the
"done" criteria (§1) and edge cases (§3) were updated consistently
(`tasks-page.test.tsx`/`calendar-page.test.tsx` render `TasksPage`/`CalendarPage`
directly, not through `RootRoute` — confirmed by grepping both test files for `render(`,
so the new wrapper genuinely can't break those two suites). This resolves the gap I
flagged in round 1 correctly and with the right justification (no new token, reuses
Tailwind defaults, matches the mockup's outermost structural choice).

### Finding 2 (root-path active-link gotcha) — resolved, and the technical claim is correct

This was worth checking at the source rather than taking the plan's word for it, since
the fix's correctness depends on TanStack Router's actual default behavior, not just
plausible-sounding prose. Read the installed package
(`node_modules/@tanstack/router-core/dist/esm/link.d.ts` and
`node_modules/@tanstack/react-router/dist/esm/link.js`) directly:

- The `ActiveOptions.exact` JSDoc says `@default false` (line 165-167 of `link.d.ts`),
  which is a little confusing because a *different* JSDoc two lines below, on the
  `activeOptions` prop itself, claims `@default {exact:true,includeHash:true}` — those
  two doc comments contradict each other.
- The actual runtime code resolves it unambiguously:
  `link.js:83` → `const exact = activeOptions?.exact ?? false;` and
  `link.js:224` → `partial: !activeOptions?.exact` (used in the route-match check). So
  when `activeOptions` is omitted entirely (today's code: bare
  `<Link to="/">Tasks</Link>`), matching is partial/prefix-based, not exact — confirming
  round 1's finding and confirming the plan's fix
  (`activeOptions={{ exact: true }}` on the `"/"` link) is the technically correct
  remedy, not just a plausible-sounding one.
- Confirmed the task route really is registered at `path: "/"` in `router.ts` and is the
  only path that's a prefix of another route path (`/calendar` isn't a prefix of
  anything else), matching the plan's claim that only the `"/"` link needs the fix.

§2.3 and §3 both call this out with a correct, specific fix and correct reasoning about
why `/calendar` doesn't need the same treatment. This resolves round 1's second gap.

### Wording tightening (README coverage-gap framing) — applied, checked against source

Round 1 flagged that the plan's prose overstated the README's problem as Modal being
misdescribed, when the README section just doesn't mention Modal/Select/CalendarPopup/
TagInput at all. Re-read the actual `components/ui/README.md` "Card/Panel vs. Button"
section (lines 29-43) again: still confirmed as a coverage gap (no mention of the four
floating-overlay components), not a misstatement. The plan's §0 finding 1 and §2.1 now
consistently use "coverage gap, not an explicit misstatement" / "not a contradiction to
'fix'" language. This is applied correctly and consistently in both places.

### New (non-blocking) finding surfaced during this round's closer read of §2.1

Section 2.1 was touched by this round's revision (the coverage-gap wording), so it's in
scope for this round's re-check per `AGENT_RULES.md`'s "what changed since round 1"
guidance. Reading it against the *actual* README turned up something the plan doesn't
address: the README already uses "family" counting language in more places than just the
one bulleted section §2.1 targets, and the plan's proposed new count conflicts with one
of them.

- `README.md` line 43 already says: "...the same way `field-base`'s `shadow-input` is a
  **third family**, for form wells (see below)." This is inside the very bullet range
  (line 29-43) that §2.1 instructs be rewritten to "three visual families" by adding
  floating-overlay as *the* third. After that edit, the doc would have two different
  things each called "the third family" in the same section — floating-overlay (per the
  new heading) and `shadow-input`/field-wells (per the pre-existing line 43, untouched
  by §2.1's instructions). That's the exact kind of internal inconsistency this ticket
  exists to eliminate.
- The "two families" phrase also appears one bullet up, in the "No Material-style
  elevation" bullet (line 26: "...depend on which of two families a component belongs
  to..."), and the "Corners" bullet (lines 52-55) also enumerates only Button/Card-Panel
  radii by name. §2.1 doesn't mention updating either of these, so a literal reading of
  the task breakdown could leave them saying "two" after the section heading above them
  says "three."
- Severity call: I'm treating this as non-blocking rather than a third round-2 gap.
  Unlike the two round-1 findings, this doesn't require new investigation, a new
  decision, or touching code/tests — it's copy sitting a few lines away from the exact
  bullet §2.1 already has the implementer editing, and the plan's own §1 "done" criteria
  ("accurately documents all three established families") already commits to the doc
  being internally coherent, which an implementer can't satisfy while leaving line 43 (or
  lines 26/52-55) contradicting the new heading. Flagging it here so it isn't missed
  during implementation/review, but it doesn't change the plan's shape or require another
  refine round.

### Verdict rationale

Both round-1 blocking gaps are genuinely fixed, not just claimed-fixed — verified against
the actual `explore/page-design` mockup file and the actual installed TanStack Router
source (not the plan's prose description of either). The wording tightening was applied
correctly. The one new observation (README's pre-existing "third family" reference to
`shadow-input` colliding with the new "three visual families" count) is real but narrow,
self-evidently something the implementer needs to reconcile to satisfy the plan's own
"done" criteria, and doesn't warrant another revision round.

VERDICT: APPROVED
