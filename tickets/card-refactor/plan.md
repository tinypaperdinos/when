# Plan: Card component refactor (issue #29)

## 0. Source

`tickets/card-refactor/ticket.md` points at GitHub issue #29, "Component library:
Refactor Card component". Full issue body (fetched via `gh issue view 29`):

> - *Currently* Cards have the same border and shadow as Buttons.
> - They should be distinguishable, e.g. by
>   - sharp corners
>   - different shadow distance
>   - Buttons not "floating" but instead "solid" (no visible distance to the shadow, or
>     no shadow and instead "side" of the button)

The issue lists three *alternative* differentiation ideas ("e.g. ... or some other
differentiation scheme") — it does not mandate combining them or picking a specific one.
This plan makes that choice explicitly (§1) rather than leaving it implicit in the diff.

## 1. What "done" means

Today `Card` (`apps/web/src/components/ui/card.tsx`) and `Panel`
(`apps/web/src/components/ui/panel.tsx`) both use the literal base-class string
`"rounded-sm border-2 border-ink bg-paper shadow-hard"` — byte-for-byte the same
corner radius and shadow treatment `Button` uses at rest (`button.tsx`'s `baseClasses`
also has `rounded-sm ... shadow-hard`). At a glance, a card and a button are
indistinguishable except by their content.

**Chosen differentiation scheme**: combine two of the three suggested approaches —
**sharp corners** + **different shadow distance** — for `Card` and `Panel` (the
"floating content container" family), and leave `Button` (the "interactive/pressable"
family) exactly as it is:

- `Card`/`Panel` switch from `rounded-sm` → `rounded-none` (sharp/square corners) and
  from the existing `shadow-hard` token (`3px 3px 0 0 var(--color-ink)`) to a new,
  larger `shadow-float` token (`6px 6px 0 0 var(--color-ink)` — double the offset,
  same hard/non-blurred aesthetic, same color-ink tie-in).
- `Button` is untouched: stays `rounded-sm` + `shadow-hard` (3px), including its
  existing `active:translate-x-[3px] active:translate-y-[3px] active:shadow-none`
  press feedback (the "solid when pressed" idea from the issue's third bullet is
  already partially implemented there for the active state — see §4 for why we're not
  extending it further).

Rationale for not choosing "Buttons solid/no shadow" as the mechanism instead: that
would mean redesigning Button's already-implemented, already-reviewed press interaction
(`README.md`'s "Press feedback" section) for a ticket titled/scoped around *Card*. The
other two bullets ("sharp corners", "different shadow distance") fully satisfy "should
be distinguishable" on their own, applied to the container family instead, without
touching Button at all.

Done = `Card` and `Panel` render with `rounded-none` + the new `shadow-float` token
instead of `rounded-sm` + `shadow-hard`; `Button` is pixel-identical to its current
behavior; the new token is documented in `components/ui/README.md` the same way
`shadow-hard`/`shadow-input` already are; existing and new tests pass; no other
component silently inherits a broken/duplicated style.

## 2. Task breakdown

1. **`apps/web/src/index.css`** — add a new theme token alongside the existing
   `--shadow-hard`/`--shadow-input` pair, inside the same `@theme` block:
   ```css
   --shadow-float: 6px 6px 0 0 var(--color-ink);
   ```
   This follows the exact existing pattern (Tailwind v4 auto-generates a `shadow-float`
   utility class from any `--shadow-*` theme key, the same mechanism already proven by
   `shadow-hard` and `shadow-input` — no plugin/config change needed). Keep
   `--shadow-hard`'s name as-is (still an accurate description — hard-edged,
   non-blurred shadow — just now specifically Button/interactive family's variant, not
   every raised surface); don't rename it, that would ripple into `button.tsx` and
   `tag-input.tsx`'s dropdown for no functional benefit.

2. **`apps/web/src/components/ui/card.tsx`** — change `baseClasses` from
   `"rounded-sm border-2 border-ink bg-paper shadow-hard"` to
   `"rounded-none border-2 border-ink bg-paper shadow-float"`. No prop/API changes.

3. **`apps/web/src/components/ui/panel.tsx`** — same `baseClasses` change as Card (see
   §4 for why Panel is included even though the issue title only says "Card").

4. **`apps/web/src/components/ui/card.test.tsx`** — add an assertion that pins the new
   contract and guards against silent regression back to the Button-shared look, e.g.:
   - `Card` renders with `rounded-none` and `shadow-float` classes present.
   - `Card` does **not** render `rounded-sm` or `shadow-hard` (the old, Button-shared
     classes) — a regression test for the exact bug this ticket fixes.

5. **`apps/web/src/components/ui/panel.test.tsx`** — same two assertions (`rounded-none`
   + `shadow-float` present, `rounded-sm`/`shadow-hard` absent).

6. **`apps/web/src/components/ui/button.test.tsx`** — add one small assertion that
   `Button` still renders `rounded-sm` and `shadow-hard` (unchanged), as a paired
   regression guard so a future edit can't silently "fix" Button and Card back into
   looking the same without a test noticing on either side.

7. **`apps/web/src/components/ui/README.md`** — update the "No Material-style
   elevation" bullet (currently says `shadow-hard` "is already reused by
   `button.tsx`/`card.tsx`/`panel.tsx`" — no longer true) to document:
   - `shadow-hard` (3px offset) = Button/interactive-pressable family, paired with
     `rounded-sm`.
   - `shadow-float` (6px offset) = Card/Panel/floating-content-container family,
     paired with `rounded-none`.
   - The rule of thumb for future components: pick whichever family matches the new
     component's role (does it get pressed/clicked as its primary interaction, or does
     it hold/frame other content?), same way `field-base`'s `shadow-input` is already
     documented as a third family for form wells.

No schema/data changes — this is presentational only. No new files.

## 3. Edge cases / things to verify

- **Current consumers**: `grep` confirms `Card`/`Panel` are only rendered from
  `apps/web/src/routes/ui-demo-page.tsx` today (no feature page consumes them yet) —
  so the blast radius of this visual change is limited to the demo page, not any
  in-progress feature UI. Worth a quick look at `/dev/ui` (dev server) after the change
  to confirm the bigger `shadow-float` offset doesn't get visually clipped by tight
  `space-y-*`/gap spacing between adjacent demo items — if it does, that's a
  demo-page-only spacing tweak, not a component API change.
- **`className` override behavior is unchanged**: `cn()` is a plain join (documented in
  `README.md` as not deduping/resolving conflicts). A consumer passing
  `className="rounded-sm"` to override `Card`'s new `rounded-none` has the same
  pre-existing, documented caveat as any other override today — not a new edge case
  introduced by this ticket, no action needed.
- **Nested Button inside Card/Panel**: confirm (visually, in the demo page) that a
  `Button` rendered inside a `Card`/`Panel` still shows its own `rounded-sm`/
  `shadow-hard` correctly — i.e. the container's new `shadow-float`/`rounded-none`
  doesn't cascade onto or clip children (neither component sets `overflow-hidden`
  today, and this change doesn't add one, so no clipping is expected, but worth a
  visual check since it's exactly the kind of interaction the ticket cares about).
- **Padding classes are untouched** (`sm`/`md` on Card, `md`/`lg` on Panel) — this
  ticket only touches corner-radius and shadow, not spacing.

## 4. Scope decisions worth calling out explicitly

- **Panel is included, not just Card.** The issue title says "Refactor Card
  component", but `panel.tsx`'s `baseClasses` is currently the literal same string as
  `card.tsx`'s. If only `Card` changed, `Panel` — which plays the same
  "static content container" role as `Card`, not the "interactive/pressable" role —
  would end up visually matching `Button` instead (defeating the point: `Panel` wraps
  entire page sections, so leaving it as a near-`Button` look would be a more visible
  inconsistency than the one being fixed). Treating "Card" in the issue as shorthand for
  "the floating-container family" is judged in scope; if this reading is wrong, the
  narrower fix (touch only `card.tsx`/`card.test.tsx`, revert `panel.tsx`) is a small,
  isolated diff to back out of. Card and Panel were originally designed and delivered
  together as siblings under issue #18 ("Component library: layout primitives (Section,
  Card, Panel)"), which is stronger evidence for treating them as one visual family than
  the coincidence of an identical string alone.
- **Section (the third sibling from issue #18) is out of scope, and correctly so.**
  `section.tsx`'s `baseClasses` is just `"space-y-3"` — no border, no shadow, no corner
  radius at all — so it was never part of the Button/Card visual overlap this ticket
  fixes, and there is nothing for this change to touch there.
- **Modal is explicitly out of scope for the visual change itself, but this is a real,
  live cross-ticket risk, not a passive footnote.** `Modal` was added on the sibling
  branch `feat/feedback-components` (commit `4c2d5ec`) and does not exist in this
  branch's working tree (`feat/card-refactor`, cut from `main`) — there is no
  `modal.tsx` file here to edit today. Modal's dialog panel currently inlines the exact
  same literal string Card/Panel use today (`rounded-sm border-2 border-ink bg-paper
  shadow-hard`, see `modal.tsx` line ~165 on that branch). As of planning, PR #38
  (`feat/feedback-components`) is **open and not draft** — i.e. already past its own
  review/fix loop and sitting ready for a human to merge — while this ticket is still in
  its plan-refinement round. That means "Modal merges to `main` before this ticket's PR
  is opened" is the *likely* order here, not a coin-flip edge case, so a purely passive
  "flag it and hope someone notices later" mitigation isn't good enough.

  Concrete step for the implementer (do this at the start of implementation, before
  writing the Card/Panel diff): run
  `git log main -- apps/web/src/components/ui/modal.tsx` (or equivalent, e.g. `git show
  main:apps/web/src/components/ui/modal.tsx`) to check whether PR #38 has merged into
  `main` yet.
  - **If it has merged** (the file now exists on `main`/is mergeable into this branch):
    pull that change into this branch (merge/rebase `main`) and fold Modal's matching
    `baseClasses` update (`rounded-sm ... shadow-hard` → `rounded-none ... shadow-float`)
    into *this* diff, alongside Card and Panel, with the same regression-test treatment
    (§2 item 4-6 pattern extended to `modal.test.tsx`). Note this in the PR description
    as "also updated Modal since #38 had already merged."
  - **If it hasn't merged yet**: fall back to the original passive mitigation — flag it
    explicitly in the PR description as a known follow-up, so either (a) a tiny
    fast-follow patch updates Modal's panel div once both branches are on `main`, or (b)
    whoever finishes `feat/feedback-components` picks it up while rebasing on top of this
    change. Don't silently let it drift either way.
- **`TagInput`'s suggestion dropdown is also out of scope.** It independently inlines
  the same base string (`tag-input.tsx`, the `<ul>` popover, ~line 174). Left
  unchanged deliberately: it's a transient listbox popover attached to its input field
  (part of the field's own interaction, closer in spirit to `field-base`'s family than
  to a standalone content container), not the kind of "Card" the issue is about.
- **`Badge` and `Checkbox`'s decorative box are unaffected and untouched.** Neither
  currently has a `shadow-hard`/`shadow-float`-style shadow at all (`badge.tsx` has no
  shadow class; `checkbox.tsx`'s custom box is `rounded-sm border-2 border-ink bg-paper`
  with no shadow), so they were never part of the Button/Card overlap the issue
  describes — no change needed.
- **Not adding `tailwind-merge`/`clsx`** to make `cn()` conflict-aware. Pre-existing,
  documented limitation (`README.md`), unrelated to this ticket's scope.
- **Not touching Button's press mechanics** (the issue's third suggested approach) —
  see §1's rationale.
- **No new demo-page sections.** `ui-demo-page.tsx` already has separate `Button` and
  `Card`/`Panel` sections; the visual diff is observable there without adding a new
  side-by-side comparison section.

## 5. Open question (flagging, not silently deciding past what's checkable)

The exact shadow offset (`6px 6px`, i.e. 2x the current `3px 3px`) and "sharp corners"
(`rounded-none` vs some intermediate value) are aesthetic judgment calls the issue
doesn't pin down numerically. This plan picks concrete values so there's something
buildable and testable, but if `reviewer-code`/the human wants a different offset (e.g.
`5px` instead of `6px`) or a less extreme corner radius, that's a one-line tweak to the
`--shadow-float` token / the `rounded-*` class, not a change to the approach.
