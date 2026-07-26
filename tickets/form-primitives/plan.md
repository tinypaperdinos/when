# Plan: Component library: form primitives (Button, Text Input, Textarea, Checkbox, Select) (issue #15)

_Revised after refiner round 1 — see the sections marked **[round 1]** for what changed
and why. Both round-1 findings are addressed in place rather than as an appendix, so the
plan reads as one coherent document._

## 1. What "done" means

Issue #15's full text:

> Generic, reusable, tested form primitives under `apps/web/src/components/ui/`. Button
> (primary/secondary/icon variants), text input, textarea (used by Notes, #5), checkbox
> (used by task completion toggle), select/dropdown.
>
> Depends on: Component library setup.

Like #18 (layout primitives), this names the primitives and (for some) their future
consumer, but specifies no props/visual spec — this plan makes those calls explicit.

Done means:

- `Button` (already real/merged from the `component-library-setup` ticket, see §2.1) is
  **extended in place** with the `icon` variant it was always scoped to grow (per its own
  in-file note and `tickets/component-library-setup/plan.md` §3.3) — not rebuilt.
- Four new generic, presentational, controlled-or-uncontrolled components exist under
  `apps/web/src/components/ui/`: `TextInput`, `Textarea`, `Checkbox`, `Select` — thin
  styled wrappers around their native HTML form elements (not custom widgets that
  reimplement keyboard/focus behavior from scratch), built on the existing border-first
  visual language, extended with one new token (`--shadow-input`, §2.3) for the
  "sunken input well" look.
- Every component (new and extended) has a colocated `*.test.tsx` (Vitest + Testing
  Library, `fireEvent` — matching existing precedent, see §2.4) covering its documented
  props/defaults and the edge cases in §4.
- Every component is registered in the dev-only demo route (`src/routes/ui-demo-page.tsx`)
  with a section showing its variants, per `components/ui/README.md`'s convention, and
  `ui-demo-page.test.tsx` is extended to assert the new/changed sections render.
- `components/ui/README.md` gets a short update documenting the new `--shadow-input`
  token and the new `field-base.ts` shared-classes module (§2.5), same treatment the
  `shadow-hard`/`cn` extraction got in the prior refactor commit (`131b911`).
- CI (`lint`, `typecheck`, `test`, `build`) stays green.

Non-goals (see §5): actually wiring any of these into a real page/feature (`TasksPage`,
Notes editor, task-completion toggle, any tag-select UI), Storybook, the full
spring-pop/confirm-ring "complete" interaction from the `explore/page-design` reference
branch, multi-select, form-level validation/error-state styling, a form-layout/`Field`
wrapper component (label+input+error composition) — that's a distinct, unrequested
component this ticket doesn't build.

## 2. Context / what exists today

### 2.1 `Button` already exists — extend, don't rebuild

`apps/web/src/components/ui/button.tsx` was built in `component-library-setup` (#14)
specifically so #15 would extend it. Current state (verified by reading the file):

```ts
export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}
```

`baseClasses`/`variantClasses`/`sizeClasses` records, `cn()`-joined, `...props` spread
onto a native `<button>`. `primary`/`secondary` are done. This ticket's only `Button`
work is adding the `icon` variant (§3.1) — `primary`/`secondary` are untouched.

Note for §2.5/§3.2 below: `button.tsx`'s `baseClasses` contains **no** `px`/`py`/`text-*`
at all — sizing lives exclusively and non-overlapping in `sizeClasses`. Same for
`card.tsx`/`panel.tsx`'s `baseClasses` vs. `paddingClasses`. This is the pattern the
round-1 fix below brings `field-base.ts`/`TextInput` in line with.

### 2.2 Established conventions (from `components/ui/README.md`, existing components)

- Filenames kebab-case, PascalCase named export matching the filename.
- Props extend the relevant native `*HTMLAttributes<...>` type; `...props` spread onto
  the root native element.
- Class composition via `cn()` (`src/lib/cn.ts`) — plain `filter(Boolean).join(" ")`, no
  `clsx`/`tailwind-merge`; consumers are responsible for not passing a conflicting
  `className` (documented limitation, not something this ticket changes).
- Visual language already in `index.css`/`README.md`: border-first (`border-2 border-ink`,
  `rounded-sm`), the `shadow-hard` raised-offset-shadow token for interactive/bordered
  boxes, dashed `focus-visible` outline (`focus-visible:outline-dashed
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`),
  `disabled:opacity-50 disabled:cursor-not-allowed`. JetBrains Mono is already the body
  default font — **don't** add `font-mono` per component (README is explicit about this;
  the unmerged `explore/page-design` prototype predates that rule and does add it —
  deliberately not copied here).
- Every new/changed component gets a section in `ui-demo-page.tsx` (manual registration).

### 2.3 New token needed: `--shadow-input`

Form fields need a visually distinct "sunken well" treatment from the "raised" look
`shadow-hard` gives buttons/cards (a text input isn't a pressable, elevated object — it's
a recessed place to type). The unmerged `explore/page-design` branch prototyped exactly
this on its scratch `<input>`: `shadow-[inset_2px_2px_0_0_var(--color-line)]`.

Rather than repeat the mistake that `shadow-hard` itself was extracted to fix (a literal
arbitrary-value shadow duplicated across files, cleaned up in `131b911` only after PR
review flagged it — see that commit's message), this plan adds the token **from the
start**: `--shadow-input: inset 2px 2px 0 0 var(--color-line);` in `index.css`'s
`@theme` block, alongside `--shadow-hard`. Tailwind v4 auto-generates a `shadow-input`
utility from any `--shadow-*` theme key (exactly how `--shadow-hard` → `shadow-hard`
already works — verified by reading `index.css` and `button.tsx`), so no extra Tailwind
config is needed.

### 2.4 Test tooling: no new dependency

`apps/web/package.json` has `@testing-library/react` + `jsdom` but **no**
`@testing-library/user-event`. Existing tests (`button.test.tsx`) use `fireEvent` for
`click`. This plan uses `fireEvent.click`/`fireEvent.change` throughout for the new
components too (e.g. `fireEvent.change(input, { target: { value: "x" } })` for text
fields, `fireEvent.click(checkbox)` for toggling) — matching existing precedent rather
than introducing `user-event` for more realistic keystroke simulation. Flagged as a
deliberate choice, not an oversight: see §6 if this should be revisited.

### 2.5 New shared module: `field-base.ts` (proactive, not reactive, extraction)

`TextInput`, `Textarea`, and `Select` all need essentially the same field-well styling:
border, background, the new `shadow-input` token, focus-visible dashed outline, and
disabled treatment. That's the exact "rule of three" threshold the `layout-primitives`
plan named explicitly when it *declined* to extract `Card`/`Panel`'s shared bordered-box
classes (`tickets/layout-primitives/plan.md` §5: "Two call sites duplicating a short
class string isn't worth an abstraction yet; revisit if a third bordered-box component
appears"). Here there are three call sites from the start, and the shared string is
longer (border + background + shadow + two interaction-state variants) than
`Card`/`Panel`'s three classes. Also directly informed by `131b911`: that commit is a
real precedent of PR review flagging exactly this kind of duplication (a literal shadow
value across `button`/`card`/`panel`) and extracting it afterward — this plan pre-empts
the same finding recurring rather than waiting for a review round to raise it again.

**[round 1] Padding/text-size are deliberately *not* part of this shared string.** The
original draft of this plan baked "md"-sized padding/text-size directly into
`fieldBaseClasses` and had `TextInput`'s `sm` override rely on appearing later in the
`cn()` call to "win" in the cascade. `plan-refiner` correctly flagged that as a real bug,
not a style nit: Tailwind resolves same-specificity conflicts by the order rules appear
in the *generated stylesheet*, not by class-attribute order, so which value actually
rendered for `sm` was undefined by anything this plan controlled — and the test plan as
originally written (§4, asserting the class *names* are present) wouldn't have caught it,
since both conflicting classes would legitimately be present in the string at once. Fixed
mechanically below: `fieldBaseClasses` now contains only non-overlapping,
size-independent styles. See §3.2 for `TextInput`'s corrected `sizeClasses`, and §3.3/§3.5
for how `Textarea`/`Select` (which have no size axis) supply their own padding/text-size
at the call site instead of inheriting it from the shared module.

New file `apps/web/src/components/ui/field-base.ts` (not a component — no
`*HTMLAttributes` export, nothing to instantiate or render):

```ts
export const fieldBaseClasses =
  "w-full rounded-sm border-2 border-ink bg-paper " +
  "shadow-input outline-none placeholder:text-ink/40 " +
  "focus-visible:outline-dashed focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-line/10";
```

Used by `text-input.tsx`, `textarea.tsx`, `select.tsx` via `cn(fieldBaseClasses,
<call-site padding/text-size classes>, className)`. Each of the three consumers supplies
its own complete, non-overlapping padding/text-size classes at the call site (`TextInput`
via its `sizeClasses` map, §3.2; `Textarea` and `Select` via a single fixed string each,
§3.3/§3.5, since neither has a size axis) — mirroring how `button.tsx`/`card.tsx`/
`panel.tsx` keep size classes exclusive in their own variant maps rather than layered
across a shared base + override. No colocated test file for `field-base.ts` itself — it's
a single string constant with no branching/logic, and its correctness is exercised
transitively by the three consuming components' own class-assertion tests (§4). (Flagged
by `plan-refiner` as a minor, non-blocking point: the closest existing precedent,
`src/lib/cn.ts`, does have a colocated test — but `cn.ts` has actual branching
(`filter(Boolean)`) and `field-base.ts` doesn't, so the distinction holds; if a future
ticket gives `field-base.ts` its own logic — e.g. a size axis — it should pick up a test
at that point, not be grandfathered out by this precedent.) `Checkbox` does **not** use
this module — its visual structure (a small custom-styled box + hidden real input, §3.4)
is nothing like a text-field well, so there's no shared string to extract there.

### 2.6 `explore/page-design` reference: what's borrowed vs. not

Per `components/ui/README.md`: "a fuller interactive exploration (loading spinner, a
circular 'complete' checkbox with a spring-pop + confirm ring, tag chip variants) lives
in the unmerged `explore/page-design` reference branch — pull patterns from there as the
tickets that need them come up." Read that branch's `design-explore-page.tsx` for this
plan. Two things are genuinely relevant here, one is not:

- **Relevant, reused:** the plain `<input>` styling (border/shadow/focus treatment,
  informing §2.3/§2.5) and the checkmark SVG path shape (`M4 12.5l5 5L20 6`, reused for
  `Checkbox`'s check glyph, §3.4).
- **Not reused:** the `CompleteCheckbox` component itself — a circular button with
  `useState`-driven internal toggle state, a spring-overshoot pop animation, and an
  expanding confirm-ring effect. That component is purpose-built for *the* task-complete
  interaction (the reference branch's own comment: "this is THE feature ... it gets to
  break the grid"), not a generic reusable form checkbox. See §3.4/§6 for why this
  ticket's `Checkbox` is the plain generic primitive, not that component, and why that's
  flagged as the one genuinely ambiguous scope call in this plan.

## 3. Task breakdown

### 3.1 `apps/web/src/components/ui/button.tsx` (modified) — add `icon` variant

```ts
export type ButtonVariant = "primary" | "secondary" | "icon";
```

- New `iconSizeClasses: Record<ButtonSize, string>` (`sm: "p-1.5"`, `md: "p-2"`) used
  instead of the existing `sizeClasses` when `variant === "icon"` — icon buttons are
  square (equal padding, no `px`/`py`/`text-*` asymmetry), sized to roughly match the
  text buttons' footprint at the same `size`.
- New `variantClasses.icon` entry: reuses `secondary`'s color treatment (`"bg-paper
  text-ink border-ink hover:bg-line/30"`) — deliberate decision, not an oversight: the
  `icon` variant is about **shape** (square, no visible text), not a new color scheme.
  A consumer wanting an accent-colored icon button passes `className` to override (same
  documented `cn()` limitation as everywhere else). Flagged in §6 as a low-risk judgment
  call in case product wants icon buttons visually distinct from secondary by default.
- `Button` picks `iconSizeClasses[size]` when `variant === "icon"`, else `sizeClasses[size]`.
  Everything else (`baseClasses`, disabled handling, `...props` spread) is unchanged.
- **`aria-label` requirement is documented, not type-enforced.** An icon-only button has
  no visible text, so it needs `aria-label` (or `aria-labelledby`) for an accessible
  name. Considered a discriminated-union prop type (`variant: "icon"` requiring
  `aria-label: string`) and rejected: it would make `ButtonProps` meaningfully more
  complex for one variant, and the codebase's established enforcement level for this
  kind of consumer responsibility is "README + code review," not a type-system trick
  (matches `component-library-setup`'s explicit call not to add mechanical enforcement
  for the `components/ui/` convention itself). Instead: an in-file comment above
  `ButtonVariant` states the requirement, and every demo-route/test usage of the `icon`
  variant models it correctly (aria-label always supplied).
- Test additions to `button.test.tsx`: icon variant renders at `sm`/`md` with an
  `aria-label`, is queryable via `getByRole("button", { name: <label> })` (proving the
  accessible name resolves correctly, since icon buttons have no text content), `onClick`
  fires, `disabled` is respected — same shape as the existing primary/secondary
  assertions, kept as its own `describe`/test block rather than folded into the existing
  `variants`-array loop (that loop asserts on visible text content, which icon buttons
  don't have).

### 3.2 `apps/web/src/components/ui/text-input.tsx` (new)

```ts
export type TextInputSize = "sm" | "md"; // default "md"
export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: TextInputSize;
}
```

**Same `Omit` pattern as `Section`/`Panel`'s `title` clash (see
`tickets/layout-primitives/plan.md` §3.1), stated so it isn't rediscovered from
scratch:** `InputHTMLAttributes<T>` already declares a native `size?: number` attribute
(visible width in characters) — redeclaring `size` as our `"sm" | "md"` variant without
first `Omit`-ing it is a TypeScript incompatible-override error that fails `typecheck`.
Tradeoff accepted: this forfeits the native numeric `size` attribute, which nothing in
this ticket's scope (a generic text field, eventually used by Notes per #5) needs.

- Root element: native `<input>`. No `type` default is forced — if the consumer omits
  `type`, the browser's own default (`text`) applies; other text-like types (`email`,
  `search`, `date`, etc.) work by passing `type` through `...props` since nothing in this
  component special-cases it.
- Classes: `cn(fieldBaseClasses, sizeClasses[size], className)`, where
  `sizeClasses: Record<TextInputSize, string> = { sm: "px-2 py-1 text-sm", md: "px-3
  py-2 text-base" }`. **[round 1, fixes the blocking finding]** `fieldBaseClasses` does
  **not** contain any padding/text-size (§2.5) — `sizeClasses.sm` and `sizeClasses.md`
  are each a complete, self-contained, non-overlapping set of padding+text-size classes,
  exactly like `button.tsx`'s `sizeClasses` / `card.tsx`/`panel.tsx`'s `paddingClasses`.
  The original draft of this plan had `md`'s padding baked into `fieldBaseClasses` and
  relied on `sizeClasses.sm` appearing later in the `cn()` call string to "win" over it
  for the `sm` case — that reasoning was wrong: Tailwind resolves same-specificity
  conflicts by the order rules appear in the *generated stylesheet*, not by
  class-attribute order, so which value actually rendered was undefined by anything this
  plan controlled, and it's exactly the kind of thing a class-string-presence test
  wouldn't catch (both conflicting classes would legitimately be present in the DOM at
  once). With `fieldBaseClasses` now size-classes-free, there's no overlapping utility
  pair on the element at any size, so this class of bug can't recur here, and the §4
  test assertion ("`sm` vs `md` produces the corresponding padding/text-size classes")
  is now a meaningful proof of what renders, not just a class-name-presence check that
  could pass while the wrong value actually wins visually.
- `w-full` is part of `fieldBaseClasses` — text fields default to filling their
  container (matches the "Add a task" mockup in the reference branch, where the input
  takes remaining flex space next to a `Button`). A consumer needing an inline/auto-width
  input overrides via `className` (same documented `cn()` caveat as elsewhere).
- No default `value`/`onChange` handling beyond native passthrough — fully
  controlled-or-uncontrolled via standard React `<input>` semantics, no internal state.

### 3.3 `apps/web/src/components/ui/textarea.tsx` (new)

```ts
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}
```

No custom props beyond native ones — no `size`/`variant` axis planned for `Textarea`
(see §5 for why), so no `Omit` is needed (no clash with any native attribute).

- Root element: native `<textarea>`. Classes: `cn(fieldBaseClasses, "px-3 py-2 text-base
  min-h-24 resize-y", className)`. **[round 1]** `px-3 py-2 text-base` is `Textarea`'s
  own padding/text-size, supplied at the call site rather than inherited from
  `fieldBaseClasses` — per the §2.5 fix, the shared module no longer carries any
  padding/text-size, so every consumer states its own. Since `Textarea` has no size axis,
  this is a single fixed string rather than a `sizeClasses` map (contrast `TextInput`,
  §3.2). `min-h-24` (~96px) gives a reasonable default height without forcing a `rows`
  value — a consumer passing `rows` explicitly still works (native attribute, passed
  through `...props`, independent of the Tailwind min-height). `resize-y` allows
  vertical-only manual resizing (matches typical multi-line note-taking UX; horizontal
  resize would break the `w-full` layout).
- No default `value`/`onChange` — same controlled-or-uncontrolled native passthrough as
  `TextInput`.

### 3.4 `apps/web/src/components/ui/checkbox.tsx` (new)

```ts
export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}
```

`type` is `Omit`-ted and hardcoded to `"checkbox"` internally — same reasoning pattern as
the other `Omit` cases: this component *is* a checkbox, so letting a consumer pass a
conflicting `type` doesn't make sense.

**Structure (three sibling elements under one relative wrapper, using Tailwind's `peer`
variant), reasoned explicitly since it's the least obvious part of this ticket:**

```
<label className={cn("inline-flex cursor-pointer items-center gap-2 select-none", disabled && "cursor-not-allowed opacity-50", className)}>
  <span className="relative inline-flex size-5 shrink-0">
    <input type="checkbox" className="peer absolute inset-0 m-0 cursor-pointer opacity-0" {...props} />
    <span className="pointer-events-none absolute inset-0 rounded-sm border-2 border-ink bg-paper transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-dashed peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
    <svg className="pointer-events-none absolute inset-0 m-auto size-3 opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6" stroke="var(--color-paper)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
  {label && <span className="text-sm">{label}</span>}
</label>
```

- The real `<input type="checkbox">` stays the actual interactive element — sized to
  fill the visual box (`absolute inset-0`) and just made transparent (`opacity-0`), not
  shrunk to 1px/`sr-only`. This keeps the native click/keyboard/focus/screen-reader
  behavior fully intact and the visible box as its exact hit target, rather than
  reimplementing toggle behavior by hand (matches this ticket's "thin wrapper around
  native elements" principle, §1).
- The visual box and checkmark `<svg>` are **siblings** of the `<input>` (not nested
  inside a sibling), because Tailwind's `peer-*` variant matches only direct
  general-siblings of the `.peer` element, not arbitrary descendants of a sibling. This
  is why the structure is three flat siblings under one `relative` wrapper rather than
  the box "containing" the checkmark with the checkmark relying on the box's own
  `peer-checked` state — spelled out here so the implementer doesn't restructure it into
  a nested form that silently stops working.
- No internal `useState`/toggle logic — fully controlled-or-uncontrolled via the native
  `checked`/`defaultChecked`/`onChange` props, forwarded through `...props` onto the
  `<input>`. This is a deliberate contrast with the reference branch's
  `CompleteCheckbox` (§2.6), which does own its state — that's appropriate for a
  one-off page interaction, not for a reusable primitive that a future ticket needs to
  wire to a controlled tRPC-backed `completed` field.
- **`className` lands on the outer `<label>`; the rest of `...props` (native input
  attributes — `checked`, `onChange`, `disabled`, `id`, `name`, `required`, `aria-*`,
  `data-*`) lands on the `<input>`.** Called out because it's an asymmetry versus every
  other component in `ui/` (where `className` and `...props` both land on the same root
  element): here the visual "root" (the `<label>`) and the semantic form control (the
  `<input>`) are different elements, and a consumer styling a checkbox's layout in a form
  (e.g. spacing) wants to target the wrapper, not an invisible input.
- `disabled` needs to visually affect the wrapper (`opacity-50 cursor-not-allowed`) even
  though it's a native attribute on the nested `<input>` — read from `props.disabled`
  before spreading, applied to the `<label>`'s class list via `cn()`.
- `label` is optional. When given, rendered as visible text inside the `<label>` (native
  label-wraps-control association, no `id`/`htmlFor` plumbing needed — unlike
  `Section`/`Panel`'s `useId()` heading pattern, this doesn't need generated ids at all).
  When omitted, the `<label>` still wraps just the checkbox box (harmless — label
  wrapping an empty-of-text control is valid HTML) but the checkbox then has **no
  accessible name** unless the consumer supplies `aria-label`/`aria-labelledby` via
  `...props`. Same documented consumer-responsibility pattern as the icon `Button`
  variant (§3.1) — not a gap, an explicit tradeoff for a primitive that must support
  both "checkbox with visible label text" and "checkbox in a context with its own
  external label" (e.g. a table row).
- No `indeterminate` support (§5) — not needed for a binary complete/incomplete toggle,
  and setting it requires an imperative DOM property (not a JSX attribute), which is
  extra complexity nothing in this ticket's scope calls for.

### 3.5 `apps/web/src/components/ui/select.tsx` (new)

```ts
export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple"> {
  placeholder?: string;
}
```

**[round 1, addresses the minor non-blocking finding]** `multiple` is `Omit`-ted: the
custom chevron/`appearance-none` styling (below) assumes a single-line, single-value
`<select>`; a native multi-select listbox renders as multiple visible rows and would
collide with the absolutely-positioned chevron. Same `Omit` pattern as `type` on
`Checkbox` (§3.4) and `size` on `TextInput` (§3.2) — the original draft of this plan
listed multi-select as out of scope in prose (§5) without actually preventing it at the
type level, so a consumer could still pass `multiple`, get it forwarded through
`...props`, and produce a broken render. `Omit`-ting it means passing `multiple` is now
a `typecheck` error, consistent with how every other unsupported-attribute case in this
ticket is handled. No `Omit` is needed for `placeholder` itself — `SelectHTMLAttributes`
has no `placeholder` field to clash with (native `<select>` has no `placeholder`
attribute; this is a component-level convenience, not a native passthrough).

- Root: a wrapping `<div className="relative">` containing the native `<select>` plus an
  absolutely-positioned chevron `<svg>` (`pointer-events-none absolute right-2
  inset-y-0 my-auto`), because native `<select>` arrow rendering is inconsistent across
  browsers and this component uses `appearance-none` to suppress it and draw a consistent
  one, matching the border-first/no-native-chrome visual language used everywhere else in
  `ui/`.
- `<select>` classes: `cn(fieldBaseClasses, "px-3 py-2 text-base appearance-none pr-8",
  className)` — `pr-8` reserves room for the chevron so option text doesn't render
  underneath it. **[round 1]** `px-3 py-2 text-base` is `Select`'s own padding/text-size,
  supplied at the call site rather than inherited from `fieldBaseClasses` — per the §2.5
  fix, the shared module no longer carries any padding/text-size. Since `Select` has no
  size axis, this is a single fixed string rather than a `sizeClasses` map (contrast
  `TextInput`, §3.2).
- `placeholder`, when given, renders as the first child: `<option value="" disabled
  hidden>{placeholder}</option>`, before the consumer's own `children`. Standard
  "fake placeholder" technique for `<select>` (no native `placeholder` attribute exists).
  `disabled` keeps it unselectable once the user opens the dropdown; `hidden` keeps it
  out of the reopened options list while it can still show as the initial displayed text.
  Verified behavior: per the HTML select spec, when no `<option>` has `selected` and no
  `value`/`defaultValue` is given to the `<select>`, the **first** option in DOM order is
  the initially-selected/displayed one, even if `disabled` — so an untouched `Select`
  with a `placeholder` and no `value` shows the placeholder text by default, without
  needing `<select defaultValue="">`. This is a judgment call flagged in §6: the issue
  doesn't ask for a placeholder, but it's a common, low-complexity need for the kind of
  "choose a tag"-style dropdown a future feature ticket will likely want.
- `...props`/`children` spread onto the native `<select>` (not the wrapping `<div>`) —
  `<option>`s are passed as ordinary `children` (native composition), not a custom
  `options` array prop, matching this ticket's "thin wrapper, not a reimplementation"
  principle used for every other field here.
- `className` (consumer override) lands on the `<select>` itself, not the wrapping
  `<div>` — consistent with `TextInput`/`Textarea`/every other component where
  `className` targets the single meaningful element; the wrapping `<div>` here is pure
  positioning plumbing for the chevron, not something a consumer needs to reach.

### 3.6 `apps/web/src/index.css` (modified)

Add `--shadow-input: inset 2px 2px 0 0 var(--color-line);` inside the existing `@theme`
block, next to `--shadow-hard` (§2.3). No other changes.

### 3.7 `apps/web/src/components/ui/README.md` (modified)

Short additions, same treatment as the `131b911` refactor:

- Mention `shadow-input` alongside the existing `shadow-hard` bullet: "sunken" field-well
  shadow for form controls vs. "raised" offset shadow for buttons/cards.
- New short bullet under "Class composition" describing `field-base.ts`: a shared
  `fieldBaseClasses` string used by `TextInput`/`Textarea`/`Select` (not itself a
  component), extracted from the start because three components need the same field
  styling (see the module's own doc comment, §2.5, for the fuller "why now not later"
  reasoning). Note that padding/text-size are deliberately *not* part of this shared
  string — each consumer states its own (§2.5, §3.2–§3.5) — so future field-like
  components should reuse `fieldBaseClasses` for the size-independent styling but still
  supply their own padding/text-size at the call site, not assume it's inherited.

### 3.8 `apps/web/src/routes/ui-demo-page.tsx` (modified)

One new `<h2>`-headed block per component, following the existing pattern (label +
rendered example, same `variant / size:` label style already used for `Button`):

- **Button — icon variant**: `sm`/`md` examples, each with a distinct `aria-label` (e.g.
  "Add item") and a small inline `<svg>` plus-icon as children (no new icon-library
  dependency — a couple of lines of local SVG markup in the demo file is enough; see §5
  for why a full icon library isn't added).
- **TextInput**: `sm`/`md` size examples with a placeholder, plus one `disabled` example.
- **Textarea**: one example with a placeholder and visible multi-line default content.
- **Checkbox**: one unchecked example with a `label`, one `defaultChecked` example with a
  `label`, one `disabled` example with a `label`.
- **Select**: one example with a `placeholder` and a few `<option>` children, one example
  with `defaultValue` pre-selecting a non-placeholder option.

### 3.9 `apps/web/src/routes/ui-demo-page.test.tsx` (modified)

Extend with assertions (same style as existing Button/Section/Card/Panel assertions)
that each new demo block's heading and labeled examples are present — e.g. the icon
Button block is queryable via `getByRole("button", { name: "Add item" })`, the Checkbox
block's labels are queryable via `getByLabelText`, etc. Same "demo route actually shows
what it claims to" principle as the existing suite.

### 3.10 Files touched/created (summary)

New:
- `apps/web/src/components/ui/text-input.tsx`, `text-input.test.tsx`
- `apps/web/src/components/ui/textarea.tsx`, `textarea.test.tsx`
- `apps/web/src/components/ui/checkbox.tsx`, `checkbox.test.tsx`
- `apps/web/src/components/ui/select.tsx`, `select.test.tsx`
- `apps/web/src/components/ui/field-base.ts` (no test file, see §2.5)

Modified:
- `apps/web/src/components/ui/button.tsx`, `button.test.tsx` (+ `icon` variant)
- `apps/web/src/index.css` (+ `--shadow-input` token)
- `apps/web/src/components/ui/README.md` (+ `shadow-input`, `field-base.ts` mentions)
- `apps/web/src/routes/ui-demo-page.tsx`, `ui-demo-page.test.tsx`

Not touched: `router.ts`, `root-route.tsx` (demo route already registered/linked from
`component-library-setup`), `package.json`/`package-lock.json` (no new dependency, §2.4
and §5), any Prisma/server code (frontend-only, presentational components).

## 4. Edge cases and error conditions to cover in tests

- **Button (icon variant)**: renders at `sm`/`md` with an `aria-label`, resolves as an
  accessible button via `getByRole("button", { name: <label> })`; `onClick` fires;
  `disabled` is respected (not fireable); existing `primary`/`secondary` tests
  unaffected (regression check — no shared-code change should alter their output).
- **TextInput**: `sm` vs `md` produces the corresponding padding/text-size classes (now a
  meaningful assertion post-round-1-fix: since `sizeClasses.sm`/`md` are complete,
  non-overlapping sets and `fieldBaseClasses` carries no padding/text-size of its own,
  the rendered class list actually reflects what's visually applied, rather than
  potentially containing two conflicting utilities whose winner depends on Tailwind's
  internal stylesheet order); default (`size` omitted) is `md`; typing/controlled
  updates work (`fireEvent.change` + assert `value`); `placeholder` renders; `disabled`
  prevents `fireEvent.change` from updating a controlled value (native behavior, worth
  asserting since it's cheap, same precedent as `Button`'s disabled/`onClick` test);
  `className` merges with base classes; arbitrary native props (`id`, `name`,
  `required`, `data-testid`) forwarded via spread; renders with zero props without
  throwing.
- **Textarea**: multi-line value (containing `\n`) round-trips through
  `fireEvent.change`; `disabled` prevents updates; `rows` native prop is forwarded and
  doesn't fight with the `min-h-24` default; `className` merges; native props forwarded;
  renders with zero props without throwing.
- **Checkbox**: unchecked by default; `fireEvent.click` on the checkbox toggles it (for
  an uncontrolled instance, assert via the native `checked` DOM property since there's
  no internal state to inspect otherwise); `fireEvent.click` on the visible `label` text
  also toggles it (native label-association behavior — proves the "no `id`/`htmlFor`
  plumbing" approach actually works, not just "compiles"); `defaultChecked`/`checked`
  respected; `onChange` fires on toggle; `disabled` prevents toggling via click and
  applies the dimmed wrapper styling; renders with no `label` and is still reachable via
  `getByLabelText`/`getByRole("checkbox", { name })` when the test itself supplies
  `aria-label` (proving the "consumer supplies their own accessible name" path works,
  not just documented); `className` passed by the consumer ends up on the wrapping
  `<label>`, not the input (asserts the asymmetric prop-target design in §3.4 rather
  than assuming reviewer-tests will guess where it lands); arbitrary native input props
  (`id`, `name`, `data-testid`) forwarded onto the `<input>` specifically (not the
  wrapper) — also asserts the split explicitly.
- **Select**: renders provided `<option>` children and their text; `fireEvent.change`
  updates a controlled `value`; `placeholder` option is present, `disabled`, and (when no
  `value`/`defaultValue` is given) is the initially-selected/displayed option; `disabled`
  on the `<select>` itself prevents changes; zero `children` (empty select, no
  `placeholder` either) renders without throwing; `className` merges onto the `<select>`
  (not the wrapping `<div>` — asserted explicitly per §3.5); native props (`id`, `name`,
  `required`) forwarded.
- **Demo route**: extended assertions (§3.9) that each new/changed component's demo
  block and its labeled examples are present, catching a future edit that silently drops
  a variant — same pattern as existing coverage.
- **Not planned as a dedicated test** (documented so `reviewer-tests` doesn't expect it):
  exact pixel/class-string snapshots beyond what's needed to prove variant/size
  branching (matches existing `Button`/`Card`/`Panel` precedent of asserting
  behavior/content, not exhaustive class strings); `Select`'s `multiple` attribute
  behavior — explicitly unsupported (§5) and, as of round 1, type-enforced via `Omit`
  (§3.5), so a consumer attempting it fails at `typecheck` rather than at runtime, and a
  runtime test wouldn't be meaningful (there's no code path left to exercise —
  `multiple` simply isn't an assignable prop); `Checkbox`'s `indeterminate` state
  (explicitly out of scope, §3.4/§5); any test asserting the *absence* of an accessible
  name when `label`/`aria-label` are both omitted from `Checkbox` or `Button
  variant="icon"` — a "this is intentionally broken when misused" case isn't worth a
  dedicated assertion beyond documenting it, matching how `Button`'s existing
  icon-variant test always models correct usage rather than also testing the negative
  case.

## 5. Explicitly out of scope (scope boundary)

- **Wiring any of these into a real feature** (Notes editor using `Textarea`, a
  task-completion toggle using `Checkbox`, a tag/category picker using `Select`,
  `TextInput` in a task-creation form). Issue #15 names these as future *consumers*
  (`#5` for Notes, "task completion toggle" for `Checkbox`), not this ticket's
  deliverable — same pattern as `layout-primitives`' "actually using these primitives in
  a real page" scope boundary.
- **The full spring-pop/confirm-ring "complete" interaction from `explore/page-design`**
  (§2.6). This ticket's `Checkbox` is the plain, generic, controlled-or-uncontrolled
  primitive — flagged in §6 as the one genuinely ambiguous scope call, since the issue's
  own wording ("checkbox (used by task completion toggle)") could be read either way.
- **Multi-select (`<select multiple>`)**. The custom chevron/`appearance-none` styling
  assumes a single-line, single-value select; a native multi-select listbox renders very
  differently (multiple visible rows) and would need distinct styling this ticket
  doesn't design. Not requested by the issue ("select/dropdown" reads as single-value).
  **[round 1]** Enforced at the type level, not just documented: `SelectProps` now
  `Omit`s `multiple` from `SelectHTMLAttributes` (§3.5), so passing it is a `typecheck`
  error rather than a silently-broken render — the original draft only stated this
  boundary in prose without preventing it in code.
- **`Checkbox` `indeterminate` state.** Not needed for a binary complete/incomplete
  toggle; requires imperative DOM-property access (not a JSX attribute) for no
  requested benefit (§3.4).
- **Form-level composition** (a `Field`/`FormGroup` component pairing a label + input +
  error/help text + required-indicator). The issue lists individual primitives, not a
  composed form-field wrapper; `Checkbox` is the one component here with any built-in
  label handling, and only because a checkbox's label is conventionally *part of* the
  clickable control (native label-wraps-checkbox pattern), unlike a text input's label
  which is typically a separate, standalone element above/beside it.
- **Validation/error-state styling** (a red border, error message slot) on any field.
  Not mentioned in the issue; whichever feature ticket first needs inline validation
  (most likely the Notes or task-creation form) should extend these components in place
  then, per the established "extend, don't rebuild" precedent — not guessed at now.
- **An icon library dependency** (e.g. `lucide-react`) for the icon `Button` variant or
  the demo page's example glyphs. A couple of inline `<svg>` elements in the demo file
  are enough to prove the variant renders and looks square/icon-shaped; a real icon
  library is a separate decision for whichever ticket first needs a broad icon set,
  not bundled into this one incidentally.
- **`@testing-library/user-event` as a new dependency** (§2.4). Matches existing
  `fireEvent`-based test precedent; not introduced here.
- **`components/ui/README.md`'s broader convention text, `router.ts`, `root-route.tsx`,
  any Prisma/server change.** None needed — see §3.10.

## 6. Open questions

The genuinely ambiguous calls this plan resolved with reasoning rather than leaving
open, flagged here for visibility (most likely candidates for a refine round, in
descending order of how contestable they are):

1. **`Checkbox` scope (§2.6, §5): plain generic checkbox vs. the full spring-pop
   "complete" interaction.** The issue's parenthetical ("used by task completion
   toggle") names the *consumer*, not the visual treatment, and this plan reads that as
   "build the reusable primitive the toggle feature will use," not "build the toggle
   feature's exact bespoke animation now" — consistent with every other primitive in
   this ticket also being a plain, generic, unstyled-for-one-specific-feature component.
   If the human intended the fancier interaction to land now, that's a scope change
   worth raising explicitly rather than assumed.
2. **`Select`'s `placeholder` prop (§3.5).** Not requested by the issue text; added as a
   low-complexity, commonly-needed affordance. Easy to drop if reviewer-code considers it
   scope creep.
3. **Icon `Button` variant color (§3.1): reuses `secondary`'s palette rather than a new
   look.** A reasonable default, but genuinely just a visual call with no single correct
   answer from the issue text.
4. **`field-base.ts` proactive extraction (§2.5).** Judgment call to extract on first
   use (three components) rather than wait for a review round, informed directly by the
   `131b911` precedent. If `reviewer-code` prefers duplication-until-flagged (matching
   `layout-primitives`' `Card`/`Panel` precedent more literally), that's a quick
   inline-and-delete-the-module fix, not a redesign. **[round 1 note]**: the extraction
   itself wasn't challenged by `plan-refiner` — only what belonged inside it (padding/
   text-size did not, and has been moved out, see §2.5/§3.2–§3.5) — so this open
   question is unchanged by the round-1 revision.

None of these are blocking — each has a stated default and reasoning above.
</content>
