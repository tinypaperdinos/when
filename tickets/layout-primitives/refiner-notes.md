# Refiner notes — layout-primitives (issue #18)

## Round 1 — REVISE

Verified against `gh issue view 18`, `apps/web/src/components/ui/button.tsx`,
`components/ui/README.md`, `apps/web/src/routes/ui-demo-page.tsx` (+ its test),
`apps/web/src/index.css`, and the unmerged `explore/page-design` reference branch that
the plan cites. Overall the plan is unusually well-reasoned for a thin issue — the
Card/Panel split, the non-goals list, and the explicit surfacing of ambiguous calls in
§2/§5 are exactly the right shape for this kind of ticket. But there's one blocking
defect and a couple of real gaps that need to be closed before this goes to
implementation.

### Blocking: `title?: ReactNode` conflicts with the native `title` HTML attribute

§3.1 (`Section`) and §3.3 (`Panel`) both sketch:

```ts
export interface SectionProps extends HTMLAttributes<HTMLElement> {
  title?: ReactNode;
  actions?: ReactNode;
}
```

`HTMLAttributes<T>` (from `@types/react`, confirmed at
`node_modules/@types/react/index.d.ts:2810`, inside the `HTMLAttributes<T>` interface
starting at line 2785) already declares `title?: string | undefined` — the native
HTML tooltip attribute, which every `HTMLAttributes`-extending component inherits (this
is why `<button title="...">` works today). Redeclaring `title` as `ReactNode` in a
subinterface that extends `HTMLAttributes<HTMLElement>` is a genuine TypeScript error:

> Interface 'SectionProps' incorrectly extends interface 'HTMLAttributes<HTMLElement>'.
> Types of property 'title' are incompatible.
> Type 'ReactNode' is not assignable to type 'string | undefined'.

This isn't a style nit — as written, `section.tsx` and `panel.tsx` fail `tsc`
immediately, which fails CI's `typecheck` step (§1's own "done" criteria list
"CI (lint, typecheck, test, build) stays green"). The plan needs to either:
- rename the prop (e.g. `heading`/`titleContent`/`label`) to avoid colliding with the
  native attribute, or
- `Omit<"title">` from the extended `HTMLAttributes` before adding the `ReactNode`
  version (`interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> { title?: ReactNode; ... }`),
  explicitly forfeiting the native tooltip `title` on the root element (worth a one-line
  note on why that tradeoff is fine, since no consumer described in the issue needs a
  native tooltip on a `<section>`/`<div>` wrapper).

Either fix is small, but it has to be an explicit, stated decision in §3.1/§3.3, not
left for the implementer to trip over. `Card`/`CardProps` doesn't have a `title` prop so
it isn't affected.

### Gap: heading typography (`<h2>`/`<h3>`) classes are unspecified

§3.1-§3.3 are otherwise extremely precise — literal Tailwind class strings for base
box styles, padding variants, the divider, even the description paragraph
(`text-sm text-ink/60`) — but neither the `Section` `<h2>` nor the `Panel` `<h3>` gets an
explicit className in the task breakdown. This matters concretely here, not just as a
style nit: Tailwind's preflight (active via `@import "tailwindcss"` in `index.css`, no
opt-out found) resets heading font-size/font-weight to `inherit`, so an unstyled
`<h2>`/`<h3>` renders visually identical to surrounding body text — no size or weight
distinction at all. The plan's own cited precedent, the unmerged
`explore/page-design` branch's `design-explore-page.tsx`, explicitly styles the
equivalent heading (`<h2 className="text-lg font-medium">Today</h2>`) for exactly this
reason. The plan already calls out one place where it deliberately *doesn't* copy that
branch verbatim (the shadow color, §2.1) — it should do the same due-diligence for
heading typography instead of silently omitting it. Left as-is, the implementer either
invents a class ad hoc (contradicting §1's stated goal of "not leaving the implementer
to invent them ad hoc") or ships headings that are visually inert, undermining the
`Section`/`Panel` header row's whole purpose (visually separating a title from
content) and the demo route's purpose (visual review, per `README.md`'s "Demo route"
convention).

### Inconsistency worth a one-line justification: `Section` is a `<section>`, `Panel` is a `<div>` + explicit `role="region"`

§2.4 does the identical accessible-name-via-`aria-labelledby` trick for both
components, but via different elements: `Section` renders a native `<section>` (gets an
implicit `region` role for free once it has an accessible name), while `Panel` renders a
`<div>` and manually adds `role="region"`. Functionally the two end up equivalent, but
the plan doesn't say why `Panel` isn't also a `<section>` (which would drop the need for
the explicit `role` attribute and be one line simpler). This might be entirely
intentional (e.g. reserving `<section>` for page-level grouping vs. `Panel` being "just
a styled box that sometimes acts as a region"), but as written it reads as an
unexplained divergence between two components using the same pattern. Not blocking on
its own, but worth a sentence of reasoning in §2.2/§2.4 so a future reader doesn't
"fix" the inconsistency by accident.

### Minor: asymmetric edge-case coverage in §4

`Card` gets an explicit "renders with zero children without throwing" test; `Section`
and `Panel` don't get the equivalent (a `Section`/`Panel` with no `title`, no `actions`/
`description`, and no `children` — i.e. a fully empty instance). Cheap to add, and
`Section`/`Panel` have more conditional-rendering branches than `Card`, so if anything
they're more likely to have an empty-render edge case worth locking down. Not blocking,
but flag it for §4 to close before implementation rather than relying on
`reviewer-tests` to catch the asymmetry later.

### Minor: `CardPadding` (`sm`/`md`) vs `PanelPadding` (`md`/`lg`) use "md" for the same pixel value but different position in each scale

Not a bug (they're separate types, `p-4` in both cases), and it's defensible given
`Card` and `Panel` are separately-sized components with different visual weight. But
since the plan is otherwise very deliberate about matching `Button`'s `sm`/`md`
convention exactly, it's worth a one-line note in §2 acknowledging this is a
deliberate divergence (mid-scale differs per component) rather than something that
looks like it was just typed inconsistently.

### What's solid (no changes needed)

- Scope boundaries in §5 (no real-page adoption, no interactive `Card`, no flat/nesting
  variant, no `as` prop, no shared base-class extraction, no `clsx`) are all
  appropriately deferred with "extend in place later" reasoning matching the existing
  `button.tsx` precedent (the #15 icon-variant note) — none of these read as
  under-scoping or over-scoping for a "component library" ticket.
- The `Card`/`Panel` distinction (§2.2) is reasoned from the issue's own consumer list
  and cites accurate, verified precedent (the reference branch's task-row markup really
  does match "plain bordered `<div>`," confirmed by reading
  `design-explore-page.tsx` on `explore/page-design`).
- The literal-hex-vs-`var()` shadow decision (§2.1) is exactly the kind of
  "surface the hidden assumption" reasoning this review is supposed to demand — good
  example of doing it right, which is why the missing heading-typography call above
  stands out by contrast.
- `useId()` for React 19.2.8 (confirmed in `apps/web/package.json`) is fine, no version
  concern.
- Accessible-name/region-role reasoning (§2.4) matches the HTML-AOM/ARIA spec's actual
  behavior (bare `<section>`/`<div>` without an accessible name exposes no landmark
  role) — verified independently, not just taken on faith.

VERDICT: REVISE

## Round 2 — APPROVED

Verified the five round-1 fixes directly against plan.md's current text and, for the
`title` collision, against the real `@types/react` package and a live `tsc` run (not
just re-reading the plan's prose). No new blocking issues found; a couple of minor
observations below, not blocking.

### Fix #1 (`title` collision) — verified correct with a live compile, not just re-read

Copied the plan's exact §3.1/§3.3 interface declarations into a scratch file under
`apps/web/src/` and ran `npx tsc -p tsconfig.app.json --noEmit` against the repo's real
`@types/react` (confirmed `title?: string | undefined` at
`node_modules/@types/react/index.d.ts:2810`, inside `HTMLAttributes<T>` starting at
line 2785):

- `interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> { title?: ReactNode; actions?: ReactNode; }`
  and the equivalent `PanelProps` — **compiles clean**, zero type errors.
- The same interface *without* the `Omit` (i.e. `extends HTMLAttributes<HTMLElement>`)
  reproduces exactly the error round 1 predicted:
  `TS2430: Interface 'SectionProps' incorrectly extends interface 'HTMLAttributes<HTMLElement>'. Types of property 'title' are incompatible. Type 'ReactNode' is not assignable to type 'string | undefined'.`

So the fix is real, not just plausible-sounding — the `Omit` clause is both necessary
(removing it reproduces the exact predicted error) and sufficient (adding it back
compiles clean) against this repo's actual TypeScript/React versions.

Also checked the other custom props the plan declares on top of `HTMLAttributes` for
the same kind of collision, per the round-2 instruction:
- `actions` (`SectionProps`): grepped `HTMLAttributes`/`AriaAttributes`/`DOMAttributes`
  in `@types/react` — no bare `actions` property anywhere (only `action`/`aria-*`
  hyphenated keys on unrelated interfaces like `FormHTMLAttributes`, which `Section`
  doesn't extend). No collision.
- `description` (`PanelProps`): same check — only `aria-description`/
  `aria-describedby`/etc. exist (hyphenated ARIA attribute keys, not the bare
  `description` identifier this plan uses). No collision.
- `padding` (`CardProps`/`PanelProps`): not a native HTML attribute on `div`. No
  collision.

Confirms round 1's blocking finding is fully closed, and the round-2-requested check
for sibling collisions on `actions`/`description` turns up nothing.

### Fixes #2–#5 — confirmed present and reasoned, no new issues

- **#2 (heading classes)**: `text-lg font-medium` is now explicit on both `Section`'s
  `<h2>` (§3.1) and `Panel`'s `<h3>` (§3.3), with the preflight rationale restated at
  the point of use. Independently re-verified the cited precedent
  (`explore/page-design`'s `design-explore-page.tsx` really does use
  `<h2 className="text-lg font-medium">Today</h2>` at multiple call sites) — the
  plan's citation is accurate, not just asserted.
- **#3 (`<section>` vs `<div>+role="region"`)**: §2.2 now gives an explicit reason
  (`Section` = page-level landmark by design; `Panel` = styled content box that
  incidentally exposes a region role when titled) — reads as a deliberate, statable
  design choice now, not a silent inconsistency. Reasonable; not going to relitigate
  the underlying call itself, only checking it's now surfaced, which it is.
- **#4 (matching zero-children/no-props tests)**: §4 now gives `Section` and `Panel`
  the same "no title/actions/description, zero children, doesn't throw, no header
  markup" case `Card` already had. Symmetric now.
- **#5 (`"md"` token reuse)**: §3.3 explicitly explains `CardPadding`'s `"md"` (high end
  of `sm`/`md`) vs `PanelPadding`'s `"md"` (low end of `md`/`lg`) both mapping to `p-4`
  as a deliberate per-component scale rather than a copy-paste slip. Adequately
  justified for a presentational-only ticket.

### Additional verification beyond what was asked, worth recording

Went one level deeper than "does the plan's a11y reasoning match the spec" (already
done in round 1) to "will the planned tests in §4 actually pass against this repo's
real test stack" — traced how `@testing-library/dom`'s `getByRole` computes roles here
(`role-helpers.js`'s `getImplicitAriaRoles`, built from `aria-query@5.3.0`'s
`elementRoles` map — *not* `dom-accessibility-api`'s simpler `getRole`, which
unconditionally maps `section → region` and would have given a false sense of safety
if that were the mechanism in play). Confirmed `aria-query`'s `regionRole.js` only
associates the `region` role with a bare `<section>` when it carries a *set*
`aria-label` or `aria-labelledby` attribute (`accessibleNameRequired: true`,
`relatedConcepts` gated on `constraints: ['set']`). That means the plan's planned
assertions — `getByRole("region", { name })` matching only when `title`/`aria-labelledby`
is present, and no region role when it's absent — will actually hold in this repo's
installed `@testing-library/dom` + `aria-query` versions, not just in the abstract ARIA
spec. Not a defect, just closing a gap in how far round 1's a11y verification went.

### Minor, non-blocking observations (not asking for another round over these)

- §4's Section edge-case bullet says "matching `Card`'s equivalent zero-children case
  below" — Card's bullet is indeed textually below Section's in the doc, so this reads
  fine; flagging only because it's the kind of forward-reference that gets stale if
  bullets are ever reordered. Not worth a plan edit.
- Confirmed no stray files or workspace changes leaked from this verification (scratch
  compile file was created and removed under `apps/web/src/`, `git status` is clean
  except the expected `tickets/layout-primitives/` directory).

Nothing here rises to blocking. The plan is implementable as written, CI-green per its
own criteria (verified, not just asserted, for the one point that actually risked
`tsc` failure), and the round-1 gaps are closed with reasoning proportionate to a
presentational-only, low-risk ticket.

VERDICT: APPROVED
