# Plan: Component library: layout primitives (Section, Card, Panel) (issue #18)

## 1. What "done" means

Issue #18 is thin (see quote below) — it names the three primitives and their intended
consumers but specifies no props, variants, or visual spec. This plan makes those calls
explicit rather than leaving the implementer to invent them ad hoc.

> Generic layout/container components — sections, cards, panels — for structuring pages
> (task list, calendar, task detail/edit forms) consistently.
>
> Depends on: Component library setup.

Done means:

- Three new, generic, presentational components exist under
  `apps/web/src/components/ui/`: `Section`, `Card`, `Panel` — each with a distinct,
  non-overlapping purpose (see §2.2), built on the existing border-first visual language
  from `button.tsx`/`components/ui/README.md`, not inventing a new visual style.
- Each has a colocated `*.test.tsx` (Vitest + Testing Library) covering its documented
  props/defaults and the edge cases in §4.
- Each is registered in the dev-only demo route (`src/routes/ui-demo-page.tsx`) with a
  section showing its variants, per the existing `components/ui/README.md` convention,
  and `ui-demo-page.test.tsx` is extended to assert the new sections render.
- No new Tailwind theme tokens, no new dependencies, no backend/schema changes — this is
  presentational-only, same footprint as the `Button` ticket.
- CI (`lint`, `typecheck`, `test`, `build`) stays green — see §3.1/§3.3 for the
  `title`-prop-vs-`HTMLAttributes` fix that's required for `typecheck` to actually pass.

Non-goals (see §5): actually restructuring `TasksPage` or any real page to use these
primitives (the issue lists task list/calendar/task detail as future *consumers*, not
scope of this ticket), Storybook, an `as`/polymorphic-element prop, a "flat" no-shadow
variant, click/interactive affordance on `Card`.

## 2. Context / what exists today

### 2.1 Established conventions (from `components/ui/README.md`, `button.tsx`, `ui-demo-page.tsx`)

- Filenames kebab-case, PascalCase named export matching the filename.
- Props extend the relevant native `HTMLAttributes<...>` type, `...props` spread onto
  the root element so consumers can pass `id`, `data-testid`, `aria-*`, `onClick`, etc.
  without extra plumbing (matches `ButtonProps extends ButtonHTMLAttributes<...>`).
- Class composition: a `baseClasses` string constant + a `Record<Variant, string>` map
  per variant axis, combined via `[base, variantClasses[variant], className].filter(Boolean).join(" ")`
  — not a `clsx`/`tailwind-merge` dependency. `button.tsx` doesn't use one, so these
  three components won't either (see §5); consumers are responsible for not passing
  `className` that conflicts with a base utility.
- Visual language (already in the merged `index.css`/`README.md`, reused verbatim, no
  new tokens):
  - Border-first: `border-2 border-ink`, `rounded-sm` corners.
  - Hard offset shadow, not blurred elevation: `shadow-[3px_3px_0_0_#1e1d1b]`.
    **Decision, called out explicitly:** this is `button.tsx`'s literal hex value, not
    `var(--color-ink)`. The unmerged `explore/page-design` reference branch used
    `var(--color-ink)` for the same shadow, but that branch is explicitly "reference
    only, not for merge" — `button.tsx` is the merged precedent, so these three
    components match it exactly to avoid two different shadow-authoring conventions
    coexisting in `components/ui/`.
  - `bg-paper` background, body already sets `color: var(--color-ink)` so no explicit
    text color needed.
  - Headings: `text-lg font-medium` on `Section`'s `<h2>` and `Panel`'s `<h3>` (see
    §3.1/§3.3). Called out explicitly because it isn't otherwise obvious: Tailwind
    preflight (active via `@import "tailwindcss"` in `index.css`) resets heading
    font-size/weight to `inherit`, so an unstyled `<h2>`/`<h3>` would render visually
    identical to body text. This is the same class the unmerged `explore/page-design`
    branch's `design-explore-page.tsx` uses for its equivalent heading
    (`<h2 className="text-lg font-medium">Today</h2>`), reused here as a reasoned
    default rather than invented ad hoc.
  - No press/active/focus-visible treatment on any of the three — those are for
    genuinely interactive elements (per README's "Press feedback" section), and none of
    `Section`/`Card`/`Panel` are inherently interactive (see §5 on why `Card` has no
    `interactive` variant yet).
- Every new component gets a section in `ui-demo-page.tsx` (manual registration, not
  auto-discovery) — existing pattern: a `<h2>{ComponentName}</h2>` followed by its
  variants with visible labels.

### 2.2 Distinguishing the three primitives

The issue names three components but doesn't define how they differ. Rather than three
components with overlapping/redundant purpose, this plan gives each a distinct role,
reasoned from the issue's own list of consumers (task list, calendar, task detail/edit
forms):

- **`Section`** — page-level, semantic grouping. Renders a native `<section>`, no
  border/background (purely structural/typographic), optional `title` + `actions`
  header row (e.g. "Today" heading + a "+ new task" button, matching the pattern already
  sketched in the unmerged `explore/page-design` branch's `design-explore-page.tsx`).
  Intended to hold one or more `Card`s or a `Panel`.
- **`Card`** — compact bordered container for a single item repeated in a collection
  (a task row, an event chip in a list). No header slot — content-agnostic, consumer
  composes whatever goes inside (title, tag, date), matching how the reference branch's
  task-row mockup used a plain bordered `<div>`.
- **`Panel`** — larger bordered container for a single block of page content that
  appears once per page/section (the body of a task detail/edit form, a calendar
  wrapper). Optional `title`/`description` header block, separated from the body by a
  `border-line` divider, bigger default padding than `Card`.

`Card` and `Panel` share the same bordered-box visual language (border, shadow,
rounding) but are deliberately separate components rather than one component with a
"size" prop, because they also differ in structure (`Panel` has an optional header
block, `Card` doesn't) — collapsing them into one component with conditional header
rendering would make the "no header, used many times per page" (`Card`) vs. "optional
header, used once or twice per page" (`Panel`) distinction less obvious at the call
site. This mirrors the issue title listing them as two separate names, not one.

**Why `Section` is a `<section>` but `Panel` is a `<div>` + explicit `role="region"`,
for the same accessible-name pattern (§2.4):** `Section` is reserved for page-level
grouping — it's meant to be the outer, structural landmark a page is built from, so an
implicit native landmark role is exactly the right semantics. `Panel` is a *styled
content box* (border/shadow/padding) that typically nests *inside* a `Section` and only
incidentally also exposes a region role when titled — it isn't meant to be a
page-level landmark in its own right. Using `<div>` + explicit `role="region"` for
`Panel` keeps that "styled box, not a landmark-by-default" identity distinct from
`Section`'s, even though the two end up ARIA-equivalent once both have an accessible
name.

### 2.3 Heading levels

`Section` renders its `title` as `<h2>`; `Panel` renders its `title` as `<h3>`, since
`Panel` is expected to typically nest inside a `Section` (task detail/edit form panel
inside a "task detail" section, etc.) and headings should step down one level when
nesting, not repeat the same level as a sibling's parent. `Card` has no heading at all
(no `title` prop — see §2.2). This is a default, not a configurable `headingLevel` prop
— see §5 for why that's deferred.

### 2.4 Accessible names (minor, low-risk a11y addition)

- `Section`: when `title` is given, the `<section>` gets `aria-labelledby` pointing at
  the heading's `id` (generated via `useId()`), which is what makes a `<section>` expose
  ARIA's implicit `region` role with an accessible name (a bare `<section>` with no
  accessible name exposes no role at all, per the HTML-AOM mapping). Without a `title`,
  no `aria-labelledby`/`id` is added — nothing to point at.
- `Panel`: same `id`-generation approach for `title`, plus an explicit `role="region"` +
  `aria-labelledby` on the wrapping `<div>` (a `<div>` has no implicit role, so it has to
  be set explicitly) — only when `title` is present, same reasoning as `Section`. See
  §2.2 for why `Panel` is a `<div>` + explicit role rather than also being a `<section>`.
- `Card` deliberately gets no landmark role — cards are expected to repeat many times
  per page (a task list), and exposing every one as an ARIA landmark would pollute
  landmark/region navigation for screen reader users. This asymmetry (Section/Panel get
  a region role, Card doesn't) is intentional, not an oversight.

## 3. Task breakdown

### 3.1 `apps/web/src/components/ui/section.tsx` (new)

```ts
export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
}
```

**Note on the `Omit`, stated explicitly so the implementer doesn't have to rediscover
it:** `HTMLAttributes<T>` already declares the native `title?: string` tooltip
attribute; redeclaring `title` as `ReactNode` without first `Omit`-ing it is a
TypeScript "incompatible override" error (`string` vs `ReactNode`) that fails
`tsc`/CI's `typecheck` step. `Omit<HTMLAttributes<HTMLElement>, "title">` before adding
the `ReactNode` version resolves this. Tradeoff, and why it's fine: this forfeits the
native HTML tooltip `title` attribute on the root `<section>` element — no consumer
described in the issue (task list/calendar/task detail page structure) needs a native
tooltip on a page-level section wrapper, so this is a non-issue in practice.

- Root element: `<section>`, base class `"space-y-3"` merged with `className`.
- `useId()` generates a heading id, used for `aria-labelledby` on the section and `id`
  on the `<h2>`, only when `title` is provided (see §2.4). The `<h2>` gets
  `className="text-lg font-medium"` (see §2.1) — this is the only place font-size/weight
  is specified for the heading; without it, Tailwind preflight makes the heading
  visually indistinguishable from body text.
- Header row (`<div className="flex items-center justify-between">`) renders only when
  `title` and/or `actions` is truthy — no empty wrapper markup when neither is given.
  `title` and `actions` can appear independently (e.g. `actions` with no `title`, for an
  untitled section that still wants a top-right button) — both combinations are tested
  (§4).
- `children` render directly after the header row, with no extra spacing wrapper —
  `Section` doesn't impose internal layout on its content; a consumer with multiple
  children manages their own spacing (e.g. wraps a list in `space-y-2` itself). Called
  out so it isn't read as a missed detail.

### 3.2 `apps/web/src/components/ui/card.tsx` (new)

```ts
export type CardPadding = "sm" | "md"; // default "md"
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}
```

- Root element: `<div>`. Base classes: `"rounded-sm border-2 border-ink bg-paper
  shadow-[3px_3px_0_0_#1e1d1b]"` + padding class (`sm` → `p-3`, `md` → `p-4`).
- No header/title prop (§2.2), no landmark role (§2.4), no interactive/press variant
  (§5).
- No `title`-vs-`HTMLAttributes` conflict here since `CardProps` has no `title` field —
  see §3.1/§3.3 for the components that do need the `Omit` fix.

### 3.3 `apps/web/src/components/ui/panel.tsx` (new)

```ts
export type PanelPadding = "md" | "lg"; // default "lg"
export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  padding?: PanelPadding;
}
```

Same `Omit<..., "title">` fix as `SectionProps` (§3.1) and for the same reason:
`HTMLAttributes<HTMLDivElement>` declares the native string `title` tooltip attribute,
which collides with the `ReactNode` header prop `Panel` needs. Same tradeoff accepted
(no native tooltip on the root `<div>`).

- Root element: `<div>`. Same bordered-box base classes as `Card` (rounded, border,
  shadow) plus padding class (`md` → `p-4`, `lg` → `p-6`, default `lg`).
  **Note on reusing the name `"md"` across `CardPadding` and `PanelPadding`:** both
  resolve to the same literal Tailwind class (`p-4`), but `"md"` sits at the *low* end
  of `PanelPadding`'s scale (`md`/`lg`) versus the *high* end of `CardPadding`'s scale
  (`sm`/`md`). This is deliberate, not a copy-paste inconsistency: `Card` and `Panel` are
  separately-sized components with different default visual weight (`Card` defaults to
  `md`/compact, `Panel` defaults to `lg`/spacious), so each type's own `sm`/`md`/`lg`
  labels are relative to that component's own scale rather than a single shared padding
  token shared across components.
- Header block (`title` as `<h3 className="text-lg font-medium">`, `description` as
  `<p className="text-sm text-ink/60">`, wrapped together with `space-y-1 border-b-2
  border-line pb-3`) renders only when `title` and/or `description` is given — same
  "no empty wrapper" rule as `Section`. The `<h3>` gets the same `text-lg font-medium`
  class as `Section`'s `<h2>` (see §2.1) — kept consistent across the two heading-bearing
  components rather than diverging without reason.
- `useId()` + `aria-labelledby` + `role="region"` only when `title` is present (§2.4).
  See §2.2 for why `Panel` uses `<div>` + explicit `role="region"` rather than also
  being a `<section>`.

### 3.4 `apps/web/src/routes/ui-demo-page.tsx` (modified)

Add one `<h2>`-headed block per component, following the existing `Button` block's
shape (label + rendered example per variant combination):

- **Section**: one example with `title` + `actions` (e.g. a `Button size="sm"`) and a
  couple of `Card`s as children, doubling as a visual example of `Section`+`Card`
  composition; one example with neither `title` nor `actions` to show the bare case.
- **Card**: `sm` and `md` padding, each with short example text content and a visible
  label (`"sm:"`/`"md:"`) matching the `variant / size:` label pattern already used for
  `Button`.
- **Panel**: with `title`+`description`, with `title` only, and with neither — `md` and
  `lg` padding shown on at least one of those, each labeled.

### 3.5 `apps/web/src/routes/ui-demo-page.test.tsx` (modified)

Extend with assertions (same style as the existing `Button` assertions) that each new
demo block's heading and labels/example content are present — i.e. the demo route
actually shows what it claims to, not just "renders without throwing."

### 3.6 New test files

- `apps/web/src/components/ui/section.test.tsx`
- `apps/web/src/components/ui/card.test.tsx`
- `apps/web/src/components/ui/panel.test.tsx`

See §4 for the specific cases each should cover.

### 3.7 Files touched/created (summary)

New:
- `apps/web/src/components/ui/section.tsx`, `section.test.tsx`
- `apps/web/src/components/ui/card.tsx`, `card.test.tsx`
- `apps/web/src/components/ui/panel.tsx`, `panel.test.tsx`

Modified:
- `apps/web/src/routes/ui-demo-page.tsx`
- `apps/web/src/routes/ui-demo-page.test.tsx`

Not touched: `components/ui/README.md` (its existing wording — "buttons, inputs, the
date-time picker, tags, layout primitives, etc." — already generically covers these,
no update needed), `router.ts`, `root-route.tsx`, `index.css` (no new theme tokens),
`package.json` (no new dependency), any Prisma/server code (none of this ticket touches
the backend).

## 4. Edge cases and error conditions to cover in tests

- `Section`: renders with both `title` and `actions`; with only `title`; with only
  `actions`; with neither (no empty header `<div>` in the DOM — assert via
  `queryByRole`/structural check, not just "doesn't throw"); `title` renders as a
  heading exposing an accessible `region` role with that name (`getByRole("region", {
  name: ... })`); default render (no props beyond `children`) needs no `aria-labelledby`
  attribute at all; custom `className` is appended alongside the base `space-y-3` class;
  arbitrary native props (`data-testid`, `id`) are forwarded via spread; renders with no
  `title`, no `actions`, and zero `children` without throwing and without any header
  markup (fully empty instance, matching `Card`'s equivalent zero-children case below).
- `Card`: `sm` vs `md` padding produces the corresponding padding class; default
  (`padding` omitted) is `md`; `className` merges with base classes; renders with zero
  children without throwing; native props forwarded via spread.
- `Panel`: all four combinations of `title`/`description` present-or-absent (both, only
  `title`, only `description`, neither) — header block appears only when at least one is
  given; `role="region"` + accessible name present only when `title` is given (not when
  only `description` is given, since `aria-labelledby` needs a heading to point at);
  `md` vs `lg` padding and the `lg` default; `className` merges; native props forwarded;
  renders with no `title`, no `description`, and zero `children` without throwing and
  without any header markup (fully empty instance, matching `Card`'s equivalent case).
- Demo route: extended assertions (§3.5) that each new component's demo block and its
  labeled examples are present in the rendered output, same pattern as the existing
  `Button` coverage — catches a future edit to `ui-demo-page.tsx` that silently drops a
  variant.
- Not planned as a dedicated test (documented so `reviewer-tests` doesn't expect it):
  visual/pixel assertions on the exact shadow/border Tailwind classes beyond what's
  needed to prove padding/variant branching — matches `Button`'s existing precedent of
  asserting behavior/content, not exhaustive class-string snapshots.

## 5. Explicitly out of scope (scope boundary)

- **Actually using these primitives in a real page** (`TasksPage`, a calendar page, a
  task detail/edit form). The issue names these as future consumers, not this ticket's
  deliverable — issue #8 ("Task list view") and the not-yet-filed calendar/task-detail
  tickets are where that happens. This ticket only builds and demos the primitives.
- **`Card` interactive/clickable affordance** (hover/press states, `interactive` prop).
  None of the three primitives are inherently interactive; whichever ticket first needs
  a clickable card (most likely "Task list view", #8) should extend `card.tsx` in place
  — same precedent as `button.tsx`'s note about #15 adding an `icon` variant, rather
  than this ticket speculatively building affordance nothing currently uses.
- **A "flat"/no-shadow variant for nesting** (e.g. avoiding a doubled-up shadow when a
  `Card` sits inside a `Panel`). Considered: nesting is plausible for the task-detail-form
  use case, but it's just as plausible that ticket ends up not nesting `Card` inside
  `Panel` at all (a form body is more likely to be plain fields inside one `Panel`, not
  a `Panel` full of `Card`s). Deferred to whichever ticket actually hits this visually,
  rather than guessed at now.
- **Polymorphic `as`/element-override prop** (e.g. rendering `Card` as `<li>` or
  `<article>`). Consumers that need a specific semantic wrapper (e.g. a `<li>` around a
  `Card` in a `<ul>`) can wrap the primitive themselves — `<li><Card>...</Card></li>` is
  valid HTML since `Card` renders a `<div>`. Not adding this speculatively; extend in
  place if a real need shows up.
- **Configurable heading level** (`headingLevel` prop on `Section`/`Panel`). Fixed at
  `<h2>`/`<h3>` respectively per §2.3's reasoning about the expected nesting depth. If a
  page ends up needing `Panel` as a page's only/top-level heading, that's a real,
  concrete case to design the escape hatch around — not worth guessing the API for now.
- **A shared "bordered box" base class extracted into a common helper** between `Card`
  and `Panel` (they currently duplicate the same three base Tailwind classes). Two call
  sites duplicating a short class string isn't worth an abstraction yet; revisit if a
  third bordered-box component appears (rule of three).
- **`clsx`/`tailwind-merge` or any class-merging dependency.** `button.tsx` doesn't use
  one; introducing one for this ticket would make `Button` the odd one out instead.
  Matching the existing precedent instead (see §2.1).
- **`components/ui/README.md` changes, new Tailwind theme tokens, Storybook.** None
  needed — see §3.7 and §1.
- **Native `title` tooltip attribute on `Section`/`Panel`'s root element.** Forfeited as
  a direct consequence of the `Omit<HTMLAttributes<...>, "title">` fix in §3.1/§3.3 —
  not reintroducing it under a different prop name, since no consumer described in the
  issue needs a native tooltip on these wrapper elements.

## 6. Open questions

None blocking — the ambiguities the issue itself left open (Card vs. Panel's distinct
purpose, heading levels, accessible names, interactive affordance, nesting/shadow
stacking) are resolved with reasoning in §2 and §5 above rather than left for
`plan-refiner`/`reviewer-code` to guess at. Flagging here for visibility since none of
those distinctions come from the issue text itself — if the human disagrees with any of
these calls (most likely candidate: the `Card`/`Panel` split in §2.2, since that's the
one genuine design decision with no single "correct" answer), that's the one to raise
in a refine round.
