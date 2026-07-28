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
- **`DateTimePicker`'s date field is a custom calendar popup, not a native
  `<input type="date">`.** As of the `select-datepicker-refactor` ticket (issue #30),
  `date-time-picker.tsx` renders an internal `CalendarPopup` (`calendar-popup.tsx`) —
  a button-triggered month-grid popup, not part of this directory's public demo surface
  (same relationship `chevron-down-icon.tsx` has to `select.tsx`) — for the date field.
  The time field intentionally still renders a native `<input type="time">`: native time
  inputs are a much weaker instance of "ugly browser default" than native date inputs,
  and a full custom time-of-day picker is separable follow-up work, not something this
  ticket silently expanded into — see `tickets/select-datepicker-refactor/plan.md` §2.4
  before "fixing" this to match. `minDate` (on `DateTimePicker`) and the range guardrail
  it composes into (`DateRangePicker`'s `value.start.date || undefined`) are now
  enforced in JS — day cells before `minDate` render `aria-disabled="true"` and are
  unclickable/unreachable by keyboard — rather than via a native `min` attribute (§2.5
  of the same plan); this is a strictly *stronger* guardrail than before, not a
  regression.
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
- **`Select` is a hand-rolled listbox, not a native `<select>` wrapper — but it's *not*
  part of the composite family above.** As of the `select-datepicker-refactor` ticket
  (issue #30), `select.tsx` renders a `<button>` trigger + a custom `role="listbox"`
  popup instead of a real `<select>`/`<option>` DOM tree, reusing the ARIA-combobox
  pattern `tag-input.tsx` already established. It still stays **controlled-or-uncontrolled**
  (an internal `useState<string>` seeded once from `defaultValue ?? ""`, with a supplied
  `value` prop taking precedence): its value is a single scalar string, not a multi-field
  composite, so reconciling `props.value ?? internalState` is the same trivial pattern
  every native form element already does internally — not the class of risk that pushed
  the three components above into controlled-only. See
  `tickets/select-datepicker-refactor/plan.md` §2.6 for the full reasoning. This rewrite
  also resolves the mechanical half of `TODO(#26)` (the old `defaultValue`-fallback hack
  had nothing left to work around once there's no real `<option>`/`<select>` DOM
  relationship) — #26's broader cross-component question stays open.

## Extending an existing component vs. adding a new one

If a later ticket needs a new variant of a component that already exists here (e.g. an
`icon` variant of `Button`), extend the existing file in place — don't create a
duplicate or rebuild it from scratch. `button.tsx`'s `icon` variant (added for the
`form-primitives` ticket) is a concrete example of this in the git history.
