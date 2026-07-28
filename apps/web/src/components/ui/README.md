# `components/ui/`

Generic, reusable, presentational components — buttons, inputs, the date-time picker,
tags, layout primitives, etc. Not feature/page components (those live under
`src/routes/`).

## Conventions

- **Filenames**: kebab-case (e.g. `button.tsx`).
- **Exports**: PascalCase named export matching the component (e.g. `button.tsx` exports
  `Button`). Matches the `src/routes/` convention already used in this repo.
- **Tests**: every component gets a colocated `*.test.tsx` (e.g. `button.test.tsx`),
  Vitest + Testing Library, matching the pattern in `src/routes/tasks-page.test.tsx`.
- **Styling**: Tailwind utility classes. `src/index.css` defines the base visual design
  language — extend it further only when a component/feature ticket actually needs a new
  token (see `AGENT_RULES.md`), not speculatively. The established language:
  - **Font**: JetBrains Mono (self-hosted via `@fontsource/jetbrains-mono`), set as the
    default body font — don't add `font-mono` per component, it's already the baseline.
  - **Palette**: muted, not bright — theme tokens `ink` (near-black text), `paper`
    (off-white background), `line` (neutral border/divider), `accent` (+ `accent-dark`,
    muted teal-blue, primary interactive color), `pop` (muted rust, used for tags/labels
    that need to stand out from `accent`).
  - **No Material-style elevation**: components are border-first (`border-2 border-ink`
    is the norm, not a soft `box-shadow`). Depth comes from a hard, non-blurred offset
    shadow — the `shadow-hard` utility (a `--shadow-hard` theme token defined in
    `index.css` as `3px 3px 0 0 var(--color-ink)`), not a blurred elevation shadow. Use
    the `shadow-hard` class rather than re-typing the arbitrary-value shadow — it's
    already reused by `button.tsx`/`card.tsx`/`panel.tsx` and this keeps the color tied
    to `--color-ink` in one place.
  - **Press feedback**: on `active`, translate the element by the same offset as its
    shadow and drop the shadow instantly (`active:translate-x-[3px] active:translate-y-[3px]
    active:shadow-none`) — see `button.tsx`. Don't transition `box-shadow` itself; a
    `var()`-referenced shadow color doesn't interpolate cleanly during a transition and
    produces a visible lag. Only `transform` should be in the `transition-*` property list.
  - **Focus**: dashed outline (`focus-visible:outline-dashed focus-visible:outline-2
    focus-visible:outline-offset-2 focus-visible:outline-accent`), not Tailwind's default
    soft `ring`.
  - **Corners**: slightly rounded (`rounded-sm`), not Material's heavier rounding and not
    fully square.
  - **Field wells**: form controls (`TextInput`, `Textarea`, `Select`) use a "sunken"
    inset shadow instead of `shadow-hard`'s "raised" offset shadow — the `shadow-input`
    utility (a `--shadow-input` theme token defined in `index.css` as
    `inset 2px 2px 0 0 var(--color-line)`). A field is a recessed place to type, not a
    pressable, elevated object.
  - A fuller interactive exploration (loading spinner, a circular "complete" checkbox
    with a spring-pop + confirm ring) lives in the unmerged `explore/page-design`
    reference branch — pull patterns from there as the tickets that need them come up,
    rather than re-deciding from scratch. The tag chip variant that branch prototyped has
    now landed as `Badge`'s default (`pop`) variant (`tag-input-badge` ticket).
- **Class composition**: use the `cn` helper (`src/lib/cn.ts`) to join a component's
  base/variant classes with a consumer-supplied `className`, rather than repeating
  `[a, b, c].filter(Boolean).join(" ")` inline — it's a plain join, not `clsx`/
  `tailwind-merge`, so it doesn't dedupe or resolve conflicting utilities; consumers are
  still responsible for not passing a `className` that conflicts with a base utility.
  The `.field-base` class (`@layer components` in `index.css`) holds the shared border/
  background/`shadow-input`/focus/disabled treatment used by `TextInput`/`Textarea`/
  `Select` — a real CSS class via Tailwind's `@apply`, not an exported JS string, so
  consumers apply it with `cn("field-base", ...)` without an extra import. Deliberately
  excludes padding/text-size: each consumer supplies its own complete, non-overlapping
  padding/text-size classes at the call site, the same way `button.tsx`/`card.tsx`/
  `panel.tsx` keep size classes exclusive in their own variant maps — a future field-like
  component should reuse `.field-base` for the size-independent styling but still supply
  its own padding/text-size, not assume it's inherited.
- **Demo route**: every component here must be added to the demo page
  (`src/routes/ui-demo-page.tsx`) so it stays visible for visual review at `/dev/ui`
  (dev server only). This is manual registration, not auto-discovery — when you add a
  new component, add a section for it in `ui-demo-page.tsx` showing its variants/sizes.
- **Composite, controlled-only components**: `DateTimePicker`/`DateRangePicker` (added
  for the `date-time-picker` ticket) and `TagInput` (added for the `tag-input-badge`
  ticket) are a different shape from every other component here — instead of being a
  thin wrapper around one native element (which gets controlled-or-uncontrolled for free
  from that element's own `value`/`defaultValue`), they compose other `ui/` primitives
  (`TextInput`, `Checkbox`, and — for `DateRangePicker` — `DateTimePicker` itself;
  `TagInput` composes `TextInput` + `Badge`) into a molecule with its own derived UI
  state (e.g. "is the time field currently shown"; for `TagInput`, the in-progress draft
  text and whether the suggestion dropdown is open). They are **controlled-only**:
  `value`/`onChange` are always required, and there's no `defaultValue` escape hatch.
  This is a deliberate deviation from the rest of `components/ui/`, not an oversight —
  don't "fix" it back to controlled-or-uncontrolled without re-reading the reasoning in
  `tickets/date-time-picker/plan.md` §2.4 (reconciling internal state against an
  optionally-controlled external `value` for a two-plus-field composite is exactly the
  class of bug this codebase's history already warns about, e.g. `select.tsx`'s
  `defaultValue`-fallback `TODO(#26)`, for a much simpler single-element case). `TagInput`
  differs from the other two in two ways worth knowing before touching it: its
  autocomplete candidates come from a caller-supplied `suggestions?: string[]` prop
  rather than pure value composition (no live tag data source lives inside it — see
  `tickets/tag-input-badge/plan.md` §2.3), and its suggestion dropdown is a hand-rolled
  ARIA combobox listbox rather than composed native inputs (§2.5/§3.2 of the same plan).

- **Portal + focus-trap components**: `Modal` (added for the `feedback-components`
  ticket) is a third shape, alongside "thin native wrapper" (`Button`/`TextInput`/etc.)
  and "composite, controlled-only value component" (above). It's `createPortal`-rendered
  into `document.body` (this codebase's first use of a portal) rather than in-place, so a
  future `overflow-hidden` ancestor can't clip it. It's hand-rolled (`role="dialog"` +
  manual focus trap + Escape listener), not the native `<dialog>` element and not a new
  npm dependency — same "hand-roll the ARIA widget behavior" precedent `TagInput`
  established. Controlled-only (`isOpen`/`onClose`), `title` required (unlike `Panel`,
  where it's optional — a dialog that interrupts the whole page needs an accessible name
  essentially always). Notable mechanics, in case a future overlay component needs the
  same patterns:
  - The `Escape` listener is attached to `document`, not the panel node, since there's a
    real window right after open where focus hasn't moved into the panel yet and a
    panel-scoped (bubbling-dependent) listener would miss the keypress.
  - Backdrop-click-to-close tracks the `mousedown` target in a `ref` and cross-references
    it against the `click` target, rather than trusting `click`'s `target` alone — a
    `click` event's `target` resolves from where `mouseup` fires, so a text-selection
    drag starting inside the panel and releasing past its edge would otherwise be
    misread as a backdrop click.
  - `z-50` is this codebase's first "overlay" z-index (backdrop and panel both), chosen
    to sit above `TagInput`'s `z-10` suggestion dropdown (so a `TagInput` inside a
    future form-in-`Modal` still renders its dropdown above the modal's own panel) with
    headroom left below it for a future second overlay layer (toast, nested modal).
  - The panel is capped at `max-w-lg`/`max-h-[85vh]` with `overflow-y-auto`, so content
    taller than the viewport scrolls internally instead of pushing the close button
    off-screen. Full reasoning: `tickets/feedback-components/plan.md` §2.3–2.6.

## Extending an existing component vs. adding a new one

If a later ticket needs a new variant of a component that already exists here (e.g. an
`icon` variant of `Button`), extend the existing file in place — don't create a
duplicate or rebuild it from scratch. `button.tsx`'s `icon` variant (added for the
`form-primitives` ticket) is a concrete example of this in the git history.
