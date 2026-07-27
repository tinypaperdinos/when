# Plan: Component library: tag input + badge/chip (issue #17)

_Revised after refiner round 2 — see the **[round 2]** markers for what changed and why.
Round 1's one blocking finding (the `forwardRef`/refocus justification in §3.2/§6 item 3
didn't hold up) is addressed in place by removing the change it was built on, not as an
appendix, so the plan reads as one coherent document. Round 1's two non-blocking notes
(ARIA `role="option"` deviation; the `Badge` variant/`size` asymmetry) are also addressed
in place, each marked **[round 2]** where they land._

## 1. What "done" means

Issue #17's full text:

> A tag input component (add/remove tags, autocomplete against existing tags) and a
> display-only badge/chip component for rendering a tag. Used by Tags (#6) and the task
> list view (#8).
>
> Depends on: Component library setup.

Same shape as every prior `components/ui/` ticket: names two deliverables and their
future consumers, no props/visual spec. This plan makes those calls explicit. Both named
consumers (#6 Tags, #8 task list view) are still open/unbuilt (verified: no
`apps/web/src/routes/tags-page.tsx` or tag-bearing list UI exists yet, and there's no
`tags` router on the tRPC `AppRouter`) — so, per the same boundary every primitive ticket
before this one has drawn, this is component-library work only, not a real feature
integration.

Done means:

- Two new, generic, presentational components exist under `apps/web/src/components/ui/`:
  - **`Badge`** — a display-only chip for rendering a single tag's text. Thin,
    `Card`/`Button`-style wrapper (a variant-classed `<span>`, `...props` passthrough),
    not a data-aware component (no concept of a `Tag` id, no click/remove behavior of its
    own).
  - **`TagInput`** — add/remove tags, with autocomplete filtered against a
    caller-supplied candidate list. A **controlled-only** composite (value/onChange
    always required, no `defaultValue`) built out of `TextInput` + the new `Badge`, plus
    a hand-rolled ARIA-combobox listbox — the same "composite, controlled-only" category
    `components/ui/README.md` already documents for `DateTimePicker`/`DateRangePicker`
    (§2.4 below), extended to a third member.
- **No live data source inside `TagInput`.** Since #6 (Tags) doesn't exist yet, there is
  no `tags.*` tRPC procedure to call. `TagInput` takes `suggestions?: string[]` — a
  plain, caller-supplied array — as its autocomplete candidate list, and does no
  fetching, debouncing, or caching of its own. This is the interim-data-source decision
  the ticket explicitly asked to have flagged; reasoning and consequences in §2.3.
- Both have a colocated `*.test.tsx` (Vitest + Testing Library, `fireEvent` — matching
  every existing test in this directory) covering the edge cases in §4.
- Both are registered in the dev-only demo route (`src/routes/ui-demo-page.tsx`) per
  `components/ui/README.md`'s convention, and `ui-demo-page.test.tsx` is extended to
  assert the new sections render and are interactive.
- `components/ui/README.md` gets two short additions: `Badge`'s visual treatment is the
  first thing in this repo to actually port a "tag chip variant" out of the
  `explore/page-design` reference branch (closing out that specific pointer in the
  existing README bullet), and `TagInput` joins the "composite, controlled-only
  component" bullet already written for `DateTimePicker`/`DateRangePicker`.
- No backend/Prisma/tRPC changes, no new npm dependency (no combobox/autocomplete
  library — see §2.5), CI (`lint`, `typecheck`, `test`, `build`) stays green.
- **[round 2]** No change to `apps/web/src/components/ui/text-input.tsx` at all. Round 1
  of this plan added `forwardRef` there; removed in this revision as unnecessary (§3.2,
  §6 item 3) — `text-input.tsx` is fully out of scope for this ticket.

Non-goals (full list in §5): wiring either component into a real Tags page or task list
view, any tRPC call for tag data, a `Tag.color` schema field or per-tag color persistence,
fuzzy/typo-tolerant matching, drag-to-reorder, remote/debounced search, form-level tag
validation (length/character restrictions), a `size` variant on either component.

## 2. Context / what exists today

### 2.1 Established conventions this plan follows

Read `apps/web/src/components/ui/{button,card,text-input,select,checkbox,date-time-picker}.tsx`,
`components/ui/README.md`, `.claude/AGENT_RULES.md`, `tickets/date-time-picker/plan.md`,
`tickets/form-primitives/plan.md`, the `Tag`/`Entry` Prisma models, and the tag-chip
markup already prototyped on `explore/page-design`'s `design-explore-page.tsx` before
writing this. Conventions reused as-is:

- Filenames kebab-case, PascalCase named export matching the filename, one component per
  file.
- `cn()` (`src/lib/cn.ts`) for class composition — no `clsx`/`tailwind-merge`.
- Border-first visual language: `border-2 border-ink`, `rounded-sm`, dashed
  `focus-visible` outline, `shadow-hard` for raised/interactive boxes vs. `shadow-input`
  for sunken field wells (`Badge` uses neither — see §3.1; `TagInput`'s text field reuses
  `TextInput`, which already carries `shadow-input`).
- Test tooling: Vitest + Testing Library + `fireEvent` (no `user-event`), matching every
  existing test file in this directory, including the two composite components
  (`date-time-picker.test.tsx`, `date-range-picker.test.tsx`).
- Every new component gets a manually-registered section in `ui-demo-page.tsx` (no
  auto-discovery) and a corresponding assertion block in `ui-demo-page.test.tsx`.

### 2.2 What `explore/page-design` already prototyped for tag chips

`components/ui/README.md` explicitly points here: "a fuller interactive exploration
(...tag chip variants) lives in the unmerged `explore/page-design` reference branch —
pull patterns from there as the tickets that need them come up." That branch's
`design-explore-page.tsx` has exactly one tag-chip markup, used twice, verified by
reading it:

```html
<span class="inline-flex items-center border-2 border-ink bg-pop px-2 py-1 text-xs font-bold tracking-wide text-paper uppercase">
  #backend
</span>
```

This is the direct source for `Badge`'s default (`pop`) variant classes in §3.1 —
`bg-pop`/`text-paper` is exactly the palette `index.css`'s own comment already assigns to
that token ("muted rust, used for tags/labels that need to stand out from `accent`").
Note the literal `#` is part of the mockup's *content* (`#backend`), not CSS-generated —
`Badge` does **not** bake in a `#` prefix (see §3.1 for why); a consumer wanting the
hashtag look supplies it as part of `children`, same as the mockup does inline.

### 2.3 The interim data-source decision (explicitly flagged, per the task brief)

`TagInput`'s "autocomplete against existing tags" needs some list of candidate tag names
to filter against. Three options were considered:

- **A live `tags.list` tRPC query called from inside `TagInput` itself.** Rejected
  outright — no such procedure exists (#6 isn't built), and even if it did, every other
  component in `components/ui/` is data-fetching-free by design (`AGENT_RULES.md`: "if a
  component needs server data, it goes through a tRPC procedure" describes *page*-level
  code in `src/routes/`, not `components/ui/` primitives — `components/ui/README.md`
  calls these "generic, reusable, presentational components," and none of the existing
  ones import `trpc`/`useQuery`). Baking a live query into a presentational primitive
  would also make it untestable/undemoable without a running server + seeded data, unlike
  every other entry in this directory.
- **A caller-supplied, plain `suggestions?: string[]` prop.** Adopted. `TagInput` treats
  this as a fully-loaded, synchronous, in-memory candidate list and does its own
  client-side case-insensitive substring filtering (§3.2) — no debouncing, no loading
  state, no "fetch more" pagination. Whichever future ticket wires this to real data (most
  likely #6 or #8) is responsible for fetching the live tag list via a `useQuery` in its
  own route/page component and passing the resulting array in as `suggestions`, exactly
  the same "primitive stays generic, the feature page owns data-fetching" split every
  other `ui/` component in this repo already follows.
- **A render-prop / async `loadSuggestions` callback (so `TagInput` could support a
  future remote/debounced search without an API change later).** Rejected for now as
  speculative complexity: nothing about issue #17's text asks for remote/incremental
  search, and #6/#8 don't exist yet to have an opinion on whether the eventual tag list is
  large enough to need it. If a future ticket needs it, `suggestions` can be swapped for
  (or supplemented by) an async prop then — noted in §5/§6 as the most likely thing to
  revisit, not preemptively built.

**Also flagged: string names, not `{ id, name }` `Tag` objects.** Both `value: string[]`
and `suggestions?: string[]` are plain tag-name strings, not the Prisma `Tag` shape
(`{ id, name }`). This mirrors `Select`'s own demo usage in this codebase (a `"Choose a
tag"` example built from hardcoded string `<option>` values, no `Tag.id` involved) and
keeps `TagInput` fully backend-agnostic. The consequence — deferred to #6, not decided
here — is that whichever future ticket wires this up must decide how "add a tag by
typing a name that doesn't match any suggestion" maps onto the backend's
`Tag.name @unique` model (upsert-by-name on save, most likely, given the schema comment
"Tags are a many-to-many relation on that entity, not separate collections" implies tags
are implicitly created on assignment, not chosen from a pre-approved list — but that's a
real design call for #6's own plan, not assumed here beyond "this component allows
freeform tag creation," see §2.6).

### 2.4 `TagInput` is controlled-only, matching the existing composite-component pattern

Per `components/ui/README.md`'s existing "composite, controlled-only components" bullet
(written for `DateTimePicker`/`DateRangePicker`): a thin wrapper around one native
element gets controlled-or-uncontrolled for free from that element's own `value`; a
composite with its own derived UI state does not. `TagInput` is squarely in the second
category — it composes `TextInput` (the draft-text field) and `Badge` (rendered chips)
plus non-native derived state (draft text, whether the suggestion dropdown is open, which
suggestion is keyboard-highlighted). So `TagInput` follows the same rule:
`value`/`onChange` are always required, no `defaultValue`. This is the third component in
this repo to make that deliberate deviation, not a new one — the README addition in
§3.6 documents it as such rather than as an ad hoc choice.

### 2.5 No new dependency for the autocomplete UI

`apps/web/package.json` has no combobox/autocomplete library (`downshift`,
`@headlessui/react`, `react-aria`, etc. — verified). This plan doesn't add one: the
dropdown is a hand-rolled `<ul role="listbox">`/`<li role="option">` list, matching the
same "no new dependency introduced incidentally" pattern every prior `ui/` ticket has
followed (e.g. `date-time-picker`'s explicit "no date-parsing library added" call). If a
richer combobox is needed later (virtualized lists, more complete ARIA 1.2 keyboard
coverage), that's a deliberate future dependency decision, not something this ticket
should reach for preemptively.

### 2.6 Freeform tag creation is allowed, not restricted to `suggestions`

Read the issue text as: "autocomplete against existing tags" describes the *suggestion*
behavior (convenience/consistency, matching-as-you-type), not a hard constraint that only
suggested tags can be added. `TagInput` lets a user commit any typed, non-empty string as
a new tag via Enter, whether or not it matches an entry in `suggestions`. This is the
single most contestable reading in this plan — flagged again in §6 — because the
alternative ("must pick from the suggestion list; freeform text is rejected/ignored") is
an equally defensible interpretation of "autocomplete against existing tags," and nothing
in the `Tag` Prisma model (no separate "is this tag pre-approved" concept) argues strongly
for the restrictive reading either way.

## 3. Task breakdown

### 3.1 `apps/web/src/components/ui/badge.tsx` (new)

```ts
export type BadgeVariant = "pop" | "accent" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}
```

```tsx
const baseClasses =
  "inline-flex items-center gap-1 rounded-sm border-2 border-ink " +
  "px-2 py-1 text-xs font-bold tracking-wide uppercase";

const variantClasses: Record<BadgeVariant, string> = {
  pop: "bg-pop text-paper",           // default — matches the explore-branch mockup (§2.2)
  accent: "bg-accent text-paper",
  neutral: "bg-paper text-ink",       // outline-style, for a tag shown on a light/busy background
};

export function Badge({ variant = "pop", className, children, ...props }: BadgeProps) {
  const classes = cn(baseClasses, variantClasses[variant], className);
  return <span className={classes} {...props}>{children}</span>;
}
```

- Root element `<span>` (inline, not block) — a tag chip sits inline with other text/UI
  (a task title, a row of other chips), same reasoning `Checkbox`'s outer `<label>` uses
  for staying inline-flex.
- **`children: ReactNode`, not a `label: string` prop.** Deliberate: this keeps `Badge` a
  pure styled-box primitive (same shape as `Card`) rather than a text-only component, so
  `TagInput` (§3.2) can compose it with a label *and* an inline remove `<button>` as
  children without `Badge` needing to know about "removability" at all — `Badge` itself
  stays strictly display-only, matching the issue's own wording, and the interactive
  affordance lives entirely in `TagInput`'s own markup.
- **No built-in `#` prefix.** The explore-branch mockup's `#backend` is literal content,
  not CSS; `Badge` renders whatever `children` it's given. A consumer wanting the hashtag
  look supplies `#{tagName}` as `children` (demoed in §3.4).
- `variant` defaults to `"pop"` (the token `index.css` already documents as
  "used for tags/labels that need to stand out from `accent`" — the obvious default for a
  tag-specific component). `accent`/`neutral` are included for the same reason
  `Button`/`Card` expose small variant maps even when only one is immediately used —
  flagged in §6 as a low-risk, possibly-premature addition; trivial to trim to a single
  style if `reviewer-code` wants strict minimalism given the issue only asks for "a"
  badge/chip component (singular), not a variant set.
- **[round 2]** This grants `variant` a more permissive default than the declined `size`
  variant immediately below, and that's a deliberate distinction, not an unreconciled
  inconsistency (`refiner-notes.md` round 1, finding 3): `pop`/`accent`/`neutral` map
  one-to-one onto three color tokens `components/ui/README.md` already documents for three
  distinct semantic purposes (`pop` — "tags/labels that need to stand out from `accent`";
  `accent` — "primary interactive color"; `paper`/`ink` — the neutral pairing used
  everywhere else in this repo for a light-background/outline treatment) — the variant
  mechanism exposes tokens that already exist for other reasons, at effectively no cost.
  `size` has no equivalent precedent to piggyback on: `index.css` defines exactly one
  padding/text-size pairing for chip-scale UI, so a `size` prop would mean inventing new
  tokens for a need nobody has expressed, not exposing ones that already exist. That's the
  actual distinguishing line (reuse existing tokens vs. invent new ones) — not an
  arbitrary double standard between the two props.
- No `size` variant (§5) — always renders at one size.

### 3.2 `apps/web/src/components/ui/tag-input.tsx` (new)

```ts
export interface TagInputProps {
  value: string[];                 // currently selected tags, in the order added
  onChange: (value: string[]) => void;
  suggestions?: string[];          // candidate tags to autocomplete against — see §2.3
                                    // for why this is a plain prop, not a live query
  placeholder?: string;            // default "Add a tag…" — TextInput placeholder
  label?: string;                  // default "Tags" — aria-label for the text field
  disabled?: boolean;
  className?: string;              // applied to the outer wrapping <div>
}
```

Not `extends *HTMLAttributes<...>` — same reasoning `DateTimePicker`/`DateRangePicker`
already established (`tickets/date-time-picker/plan.md` §3.1): this isn't a thin wrapper
around one native element, so there's no single element for arbitrary native attributes
to meaningfully pass through to. `className` is the one consumer-facing escape hatch.

**Internal state** (all local `useState`, no external sync needed — none of it is ever
externally controlled, unlike `value`):

- `draft: string` — the in-progress typed text.
- `open: boolean` — whether the suggestion dropdown is visible. Not fully derived from
  `draft`/filtered-results (a tempting simplification), because `Escape` needs to be able
  to dismiss the dropdown *without* clearing `draft` — an explicit boolean is the only way
  to represent "there are matches, but the user dismissed the list" as a state distinct
  from "there are no matches." This is ephemeral, purely-local UI state with no externally
  controlled counterpart, unlike the case `components/ui/README.md`'s §2.4 note warns
  about (reconciling internal state against an *optionally-controlled external* value) —
  there's nothing here to reconcile against, so it doesn't reopen that concern.
- `highlightedIndex: number | null` — which filtered suggestion (if any) is
  keyboard-highlighted. Reset to `null` on every keystroke (rather than clamped/preserved
  across filter changes) — simplest correct behavior, since the filtered list itself
  changes shape on every keystroke and preserving "index 2" across a re-filter would
  silently highlight an unrelated item.
- **[round 2]** No `useRef`/imperative focus management is needed. Round 1 of this plan
  held a `useRef<HTMLInputElement>` here to explicitly refocus the text field after a
  suggestion was chosen by click. Removed in this revision — see the rendering notes below
  and §6 item 3 for the full reasoning (it turned out to be dead code, and would have
  required a `forwardRef` change to the already-merged `text-input.tsx`, which this
  revision avoids entirely by not needing a ref at all).
- A `useId()`-derived base id for the listbox/option ids (`aria-controls`/
  `aria-activedescendant`), so two `TagInput` instances on the same page (the demo route
  will render at least two, §3.4) don't collide on hardcoded ids.

**Derived value, computed on every render (not stored in state):**

```ts
const MAX_SUGGESTIONS = 8; // not a prop — see §6

const filtered = draft.trim() === ""
  ? []
  : (suggestions ?? [])
      .filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()))
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS);
```

- Dropdown only ever shows candidates when `draft` is non-empty **and** `open` is true —
  i.e. it never opens on focus alone to "browse" the full suggestion list. A deliberate
  scope-limiting choice (§6): "autocomplete against existing tags" reads most naturally as
  "narrow candidates as you type," not "always show a browsable full list," and the
  latter is easy to add later (change the `draft.trim() === ""` branch) if a future
  consumer wants it.
- Already-selected tags are excluded from `filtered` (case-insensitively) so the dropdown
  never re-offers a tag that's already in `value`.
- Matching and de-duplication are both **case-insensitive on comparison, but
  case-preserving on storage** — typing `"Work"` when `"work"` is already selected is
  treated as a duplicate (no-op), but a genuinely new tag is stored exactly as typed, not
  lowercased. Flagged in §6: this is a judgment call about a backend collation rule (`Tag
  .name @unique`) that isn't decided anywhere yet (SQLite's default `@unique` is
  case-sensitive) — this component doesn't attempt to guess or enforce the eventual
  backend's actual uniqueness semantics, it just avoids the obviously-wrong UX of letting
  a user visibly select "work" twice in the same input.

**Commit logic** (used by Enter-with-no-highlight, Enter-with-a-highlighted-suggestion,
and a suggestion click — all three funnel through one function):

```ts
function commitTag(tag: string) {
  const trimmed = tag.trim();
  if (trimmed === "") return;
  const alreadySelected = value.some((v) => v.toLowerCase() === trimmed.toLowerCase());
  if (!alreadySelected) onChange([...value, trimmed]);
  setDraft("");
  setOpen(false);
  setHighlightedIndex(null);
}
```

`draft` is cleared and the dropdown closed **even when the tag was already selected** (a
silent no-op add, not an error state) — matches this repo's established
"no error-message/red-border validation state" boundary for primitives
(`tickets/form-primitives/plan.md` §5's precedent), rather than inventing one just for
this duplicate case.

**Keyboard handling**, on the `TextInput`'s `onKeyDown`:

- `ArrowDown`: if `filtered.length > 0`, `preventDefault()` and move
  `highlightedIndex` forward by one, clamped at `filtered.length - 1` (starts at `0` if
  currently `null`); also sets `open` to `true` (so pressing ArrowDown can reopen a
  dismissed-by-Escape dropdown as long as there are still matches).
- `ArrowUp`: same, moving backward, clamped at `0` (no wrap-around either direction —
  §6/§5).
- `Enter`: always `preventDefault()` (so a `TagInput` nested inside a future `<form>`
  never triggers a submit). If `highlightedIndex !== null` and `filtered[highlightedIndex]`
  exists, `commitTag(filtered[highlightedIndex])`; else if `draft.trim() !== ""`,
  `commitTag(draft)`; else no-op (empty draft, nothing highlighted).
- `Escape`: if `open`, `setOpen(false)` and `setHighlightedIndex(null)`; `draft` is left
  untouched.
- `Backspace`: if `draft === ""` and `value.length > 0`, remove the last tag
  (`onChange(value.slice(0, -1))`) — lets a keyboard-only user delete the most recently
  added tag without reaching for the mouse, a common tag-input convention. If `draft` is
  non-empty, this is a no-op at the `TagInput` level (ordinary text editing proceeds
  natively).

**Typing** (`onChange` on the `TextInput`): sets `draft` to the new value; sets `open` to
`true` whenever the resulting `filtered` list (recomputed from the *new* draft) would be
non-empty, else `false`. **`onFocus`**: same open/closed recomputation, so refocusing an
input that still has matching draft text reopens the dropdown (covers the
click-a-suggestion-then-immediately-type-more case without needing a separate branch).

**Rendering:**

```tsx
<div className={cn("flex flex-col gap-2", className)}>
  {value.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {value.map((tag) => (
        <Badge key={tag} className="gap-1.5">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            disabled={disabled}
            onClick={() => onChange(value.filter((v) => v !== tag))}
            className="leading-none disabled:cursor-not-allowed"
          >
            ×
          </button>
        </Badge>
      ))}
    </div>
  )}

  <div className="relative">
    <TextInput
      role="combobox"
      aria-label={label ?? "Tags"}
      aria-expanded={open}
      aria-autocomplete="list"
      aria-controls={listboxId}
      aria-activedescendant={
        highlightedIndex !== null ? `${listboxId}-option-${highlightedIndex}` : undefined
      }
      placeholder={placeholder ?? "Add a tag…"}
      value={draft}
      disabled={disabled}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={() => setOpen(false)}
    />
    {open && filtered.length > 0 && (
      <ul
        id={listboxId}
        role="listbox"
        className="absolute z-10 mt-1 w-full rounded-sm border-2 border-ink bg-paper shadow-hard"
      >
        {filtered.map((suggestion, i) => (
          <li key={suggestion} id={`${listboxId}-option-${i}`} role="option" aria-selected={i === highlightedIndex}>
            <button
              type="button"
              className={cn("block w-full px-3 py-1.5 text-left text-sm", i === highlightedIndex && "bg-accent text-paper")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitTag(suggestion)}
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
</div>
```

- `onMouseDown={(e) => e.preventDefault()}` on each suggestion button is load-bearing, not
  decorative, for two effects at once, not one: it suppresses the mousedown-triggered
  `blur` on the `TextInput` (so `onBlur` doesn't close the dropdown, per the handler above,
  *before* the click event that selects the suggestion lands), **and**, from that same
  `preventDefault()` call, it cancels the browser's default mousedown behavior of shifting
  focus to the clicked element in the first place — so the input never actually loses
  focus during the click at all. (Confirmed against MDN's `HTMLElement.focus()`
  documentation and `javascript.info`'s "Browser default actions" page: the browser's
  default `mousedown` action *is* the focus-shift to the target element, and
  `preventDefault()` on `mousedown` cancels that default action.) This is the standard
  combobox pattern; called out explicitly so the implementer doesn't drop it as
  apparently-redundant.
- **[round 2]** Because of the second effect above, no explicit refocus call after
  `commitTag(suggestion)` is needed — the input's focus was never interrupted to begin
  with. Round 1 of this plan called `inputRef.current?.focus()` here and added
  `forwardRef` to the already-merged `text-input.tsx` to support it; both are removed in
  this revision as unnecessary. Full reasoning for why the round-1 justification didn't
  hold up, and the resolution, is in §6 item 3. `text-input.tsx` is no longer touched by
  this ticket at all — `TagInput` uses `TextInput` exactly as it exists on `main` today,
  passing no `ref`.
- **[round 2]** The listbox items are `<li role="option">` wrapping a real, independently
  tabbable `<button>`. In the `aria-activedescendant` combobox pattern this component
  otherwise follows (focus stays on the `role="combobox"` input; `aria-activedescendant`
  points at the virtually-highlighted option), options are conventionally *not* focusable
  themselves — that's what makes the "virtual focus" model meaningful. Using a real
  `<button>` per option is a known, minor ARIA-pattern deviation (`refiner-notes.md`
  round 1, finding 2), kept as-is because it's what lets a suggestion be clicked with
  ordinary button semantics (hover/focus-visible styling, no synthetic click-target
  plumbing) without a larger rewrite of the listbox — documented here as a deliberate,
  known trade-off rather than an unnoticed gap (also called out in §5). A fuller ARIA 1.2
  implementation (non-focusable options, roving `tabindex`) is future/richer-combobox-
  library territory, the same boundary §2.5 already draws.
- `disabled` is forwarded to the `TextInput` and to every remove `<button>`; the dropdown
  never opens while disabled (both `onChange`/`onFocus` handlers no-op immediately when
  `disabled`, so `open` never becomes `true`).
- Chips row and the input are stacked vertically (`flex flex-col gap-2`), **not** merged
  into a single bordered box with chips inline before the cursor (contrast e.g. GitHub's
  issue-label picker). This reuses `TextInput`'s own encapsulated border/shadow/focus
  styling as-is rather than requiring new custom field-well markup that duplicates
  `field-base`. Flagged in §6 as a reasonable interim visual choice, not the only valid
  one — a more visually integrated layout is a plausible future enhancement, not a defect.

### 3.3 `apps/web/src/components/ui/badge.test.tsx` (new), `tag-input.test.tsx` (new)

See §4 for the specific cases.

### 3.4 `apps/web/src/routes/ui-demo-page.tsx` (modified)

New `<h2>Badge</h2>` section: one example per variant (`pop`/`accent`/`neutral`), each
rendering hashtag-styled sample text (e.g. `#backend`, `#personal`, `#urgent`) to mirror
the explore-branch mockup this component is drawn from (§2.2) — proves the "no built-in
`#` prefix" design actually looks right when the consumer supplies one.

New `<h2>TagInput</h2>` section — **the third demo entry needing local `useState`**,
following the `DateTimePicker`/`DateRangePicker` precedent (§2.4):

- One example seeded with a couple of existing tags (`["work", "urgent"]`) and a
  `suggestions` list with several candidates (including some that overlap the seeded
  tags, to visually demonstrate the already-selected-tags-excluded-from-suggestions
  behavior) — lets a developer running `/dev/ui` actually type, see filtered suggestions,
  arrow through them, and remove a seeded tag.
- One example with `suggestions` entirely omitted, seeded with `value: []` — demonstrates
  the pure-freeform degrade-gracefully mode from §2.3 (type anything, press Enter, no
  dropdown ever appears).
- One `disabled` example (seeded with a tag or two, so the "chips still render but their
  remove buttons are disabled" state is visible).

### 3.5 `apps/web/src/routes/ui-demo-page.test.tsx` (modified)

Extend with assertions matching the existing style for `Badge` (heading present; each
variant's sample text reachable via `getByText`) and `TagInput` (heading present;
seeded tags reachable via their remove-button accessible names, e.g.
`getByRole("button", { name: "Remove work" })`; typing into the first example's input and
asserting a matching suggestion becomes reachable via `getByRole("option", ...)`;
confirming the no-suggestions example never renders a listbox even after typing).

### 3.6 `apps/web/src/components/ui/README.md` (modified)

- Update the existing `explore/page-design` pointer bullet: note that `Badge`'s default
  (`pop`) variant is the tag-chip pattern that branch prototyped, now actually landed.
- Extend the existing "composite, controlled-only components" bullet to list `TagInput`
  alongside `DateTimePicker`/`DateRangePicker`, with a one-line pointer to this plan's
  §2.3/§2.4 for the two things that make it different from those two (an external
  `suggestions` data source instead of pure value composition; a hand-rolled ARIA
  combobox listbox instead of native inputs).

### 3.7 Files touched/created (summary)

New:
- `apps/web/src/components/ui/badge.tsx`, `badge.test.tsx`
- `apps/web/src/components/ui/tag-input.tsx`, `tag-input.test.tsx`

Modified:
- `apps/web/src/routes/ui-demo-page.tsx`, `ui-demo-page.test.tsx`
- `apps/web/src/components/ui/README.md`

Not touched: `apps/web/src/components/ui/text-input.tsx`/`text-input.test.tsx` —
**[round 2]** an earlier version of this plan added `forwardRef` here to support
refocusing the input after a suggestion click; removed as unnecessary once the underlying
DOM mechanism was checked (§3.2, §6 item 3). `TagInput` uses `TextInput` exactly as it
exists on `main` today, with no `ref` passed. Also not touched: `index.css` (no new
tokens — `Badge` reuses existing `pop`/`accent`/`paper`/`ink` color tokens and
`border-2`/`rounded-sm`, no new shadow), `package.json`/`package-lock.json` (no new
dependency, §2.5), `router.ts`/`root-route.tsx` (demo route already registered),
`schema.prisma`/any server/tRPC code (presentational-only — see §2.3/§2.6 for why a live
tag data source and a `Tag.color` field are both deferred).

## 4. Edge cases and error conditions to cover in tests

**`Badge`:**
- Renders arbitrary `children` (plain text, and a composite of text + a nested
  `<button>`, proving it works as `TagInput`'s building block).
- Each variant (`pop` default, `accent`, `neutral`) renders its documented background/text
  color classes; omitting `variant` produces the same classes as explicitly passing
  `"pop"`.
- `className` merges onto the root `<span>`.
- Arbitrary native span attributes (`data-testid`, `id`, `aria-label`) forwarded via
  spread.
- Renders without throwing given only `children`.

**`TagInput`:**
- Renders each `value` entry as a chip with visible text and a `Remove <tag>`-labeled
  button.
- Default (`value: []`, no `suggestions`): input present, empty, labeled "Tags"; no chips;
  no listbox in the DOM.
- Typing text that substring-matches a suggestion (case-insensitively) opens the listbox
  showing only the matching, not-already-selected suggestions.
- Typing text that matches nothing keeps the listbox absent from the DOM (not just
  visually hidden — `queryByRole("listbox")` returns `null`).
- A suggestion already present in `value` is excluded from the listbox even when the
  typed text matches it.
- More than `MAX_SUGGESTIONS` (8) matches: only the first 8 are rendered as options.
- `ArrowDown` moves `aria-selected`/highlight through the filtered options in order,
  clamping at the last option (a further `ArrowDown` at the end is a no-op, doesn't
  wrap to the first); `ArrowUp` moves backward, clamping at the first (no wrap to the
  last).
- `Enter` with a highlighted suggestion commits that suggestion: `onChange` called once
  with `value` plus that tag, appended; input clears; listbox closes.
- `Enter` with no highlighted suggestion and non-empty draft text commits the typed text
  verbatim (including its original casing) as a new tag.
- `Enter` with an empty draft and nothing highlighted: `onChange` is not called.
- `Enter` on text that case-insensitively duplicates an already-selected tag: `onChange`
  is **not** called (no duplicate appended), but the draft still clears and the listbox
  still closes (silent no-op, not an error state — §3.2).
- Clicking a rendered suggestion option commits it the same way `Enter`-with-highlight
  does. **[round 2]** Also assert `document.activeElement` is (still) the text input
  immediately after the click — not because an explicit refocus call needs verifying
  (there isn't one, §3.2/§6 item 3), but because this is the actual, meaningful check that
  `onMouseDown`'s `preventDefault()` is doing its job: if it weren't wired up, focus would
  visibly move to the clicked suggestion `<button>` for the duration of the click. This
  replaces the round-1 version of this test, which claimed to verify a ref-based refocus
  that (per `refiner-notes.md` round 1, finding 1) couldn't actually be distinguished from
  "focus was never lost" in the first place — the reworded assertion tests the real,
  distinguishable mechanism instead.
- `Escape` while the listbox is open closes it (`queryByRole("listbox")` becomes `null`)
  without clearing the draft text (`input.value` unchanged).
- `Backspace` with an empty draft and at least one existing tag removes the last tag via
  `onChange` (asserted as the array minus its final element, order of the rest preserved).
  `Backspace` with a non-empty draft does not call `onChange` at all (normal text editing,
  no tag removal).
- Clicking a specific chip's remove button removes exactly that tag from `value` via
  `onChange` (assert the remaining array — order and other tags preserved — including the
  case of removing a tag from the middle of a 3+-tag list, not just the last one).
- `disabled`: the text input is disabled; every remove button is disabled; typing/
  `fireEvent.change` does not open the listbox even when draft text would otherwise match
  a suggestion (assert `queryByRole("listbox")` stays `null`); clicking a disabled remove
  button does not call `onChange`.
- `suggestions` entirely omitted (`undefined`): typing never opens a listbox (no
  suggestions to match against), but `Enter` still commits freeform tags and `Backspace`/
  remove-button removal both still work — proves the graceful-degradation path from §2.3
  end-to-end, not just "doesn't throw."
- `className` merges onto the outer wrapping `<div>`.
- `label`/`placeholder` overrides are reflected on the input (`aria-label`/`placeholder`
  respectively), and the defaults ("Tags"/"Add a tag…") are not simultaneously present.
- `aria-expanded` on the input reflects `open` (`"false"` at rest, `"true"` once a
  matching listbox is showing); `aria-activedescendant` is unset when nothing is
  highlighted and set to the highlighted option's id once `ArrowDown` has been pressed.
- Two `TagInput` instances rendered simultaneously (as the demo route will do) produce
  distinct listbox/option `id`s (proves `useId()` prevents collisions) — asserted by
  opening both instances' dropdowns and checking their listbox elements are different DOM
  nodes with different `id` attributes.
- Renders without throwing given only the minimum required props (`value={[]}` and a
  no-op `onChange`).

**`TextInput`:** **[round 2]** no changes in this ticket at all (§3.2, §6 item 3) — the
round-1 plan's `forwardRef` addition and its accompanying test (a passed `ref` resolves to
the underlying `<input>`) are both removed. The existing `text-input.test.tsx` suite is
unaffected; no new test is added here.

**Demo route:** extended assertions (§3.5) that the `Badge` and `TagInput` sections
render, show their documented variants/examples, and (for `TagInput`) are genuinely
interactive — not just "renders without throwing," matching the bar the
`DateTimePicker`/`DateRangePicker` demo assertions already set.

**Not planned as a dedicated test (documented so `reviewer-tests` doesn't expect it):**
- Any assertion depending on real browser focus/blur timing subtleties beyond what
  `fireEvent` + the `onMouseDown`-`preventDefault` pattern already covers deterministically
  in jsdom — matches this repo's `fireEvent`-only precedent (no `user-event`, §2.1).
- Fuzzy/typo-tolerant matching, remote/debounced suggestion fetching, `Tag.color`
  rendering — none of these are implemented (§5), so nothing to test.
- Arrow-key wrap-around (cycling from last match back to first, or vice versa) — not
  implemented (§3.2 clamps instead); the clamping behavior itself *is* tested above.
- Keyboard/mouse interaction with the listbox while `disabled` — covered narrowly (the
  listbox never opens while disabled, tested above); no separate test attempts to
  force-open it and check individual option interactions are blocked, since there's no
  code path that could open it in the first place.
- **[round 2]** Anything distinguishing "the listbox option `<button>`s are independently
  tabbable via keyboard `Tab`" as a positive feature — that's a known, documented ARIA
  deviation (§3.2, §5), not a designed/tested behavior; no test asserts Tab-focus
  ordering into or out of the listbox.

## 5. Explicitly out of scope (scope boundary)

- **Wiring either component into a real Tags page or the task list view.** Neither #6 nor
  #8 exists yet (verified in §1). Same "primitive first, consumer later" boundary every
  prior `ui/` ticket has drawn.
- **Any live/tRPC-backed tag data source inside `TagInput`.** `suggestions` is a plain
  prop; fetching is the future consumer's job (§2.3).
- **A `Tag.color` schema field, or any per-tag persisted color.** `Badge`'s `variant` is a
  library-level visual choice (like `Button`'s `primary`/`secondary`), not driven by
  per-tag data — no `Tag` model field exists for it, and adding one is a schema decision
  that belongs to #6 if that ticket wants user-assignable tag colors, not this one.
- **Fuzzy/typo-tolerant matching.** Plain case-insensitive substring matching only (§3.2).
- **Remote/debounced search, pagination, or a "load more suggestions" affordance.**
  `suggestions` is assumed fully loaded and synchronous (§2.3).
- **Drag-to-reorder selected tags**, or any ordering guarantee beyond "insertion order,
  append on add, filter on remove."
- **Form-level tag validation** (max length, disallowed characters, max tag count). Not
  mentioned in the issue; matches the established "validation/error-state styling is a
  future feature-ticket concern" boundary (`tickets/form-primitives/plan.md` §5).
- **Arrow-key wrap-around** in the suggestion list (§3.2/§4) — clamps instead.
- **Browsing the full `suggestions` list on focus with an empty draft** — the dropdown
  only opens once there's a non-empty, matching draft (§3.2). Easy, additive follow-up if
  a future consumer wants a "click to see all tags" browse mode.
- **A merged single bordered box combining the chip row and the text input** (contrast
  e.g. GitHub's inline label picker) — chips render above a separately-boxed `TextInput`
  (§3.2). A plausible future visual enhancement, not attempted here.
- **A `size` variant on `Badge` or `TagInput`.** Neither requested; both render at one
  size, matching how several other single-size primitives in this directory (`Card`,
  `Panel`) also started without one. (Reconciled against `Badge`'s color variants in §3.1
  — not an arbitrary asymmetry.)
- **Restricting tag creation to only what's present in `suggestions`.** Freeform creation
  is allowed by default (§2.6) — flagged there as the most contestable reading in this
  plan, not silently assumed.
- **A fuller ARIA 1.2 combobox pattern (non-focusable listbox options, roving
  `tabindex`).** **[round 2]** This ticket's listbox options are real, independently
  tabbable `<button>`s, a minor documented deviation from the strict
  `aria-activedescendant` "virtual focus" pattern (§3.2, `refiner-notes.md` round 1,
  finding 2) — acceptable for a hand-rolled, no-dependency combobox at this scope; a
  fuller ARIA implementation is richer-combobox-library territory (§2.5), not attempted
  here.
- **Any change to `apps/web/src/components/ui/text-input.tsx`.** **[round 2]** Round 1 of
  this plan added `forwardRef` there; removed as unnecessary (§3.2, §6 item 3) —
  `text-input.tsx` is untouched by this ticket.
- **`components/ui/README.md`'s broader convention text beyond the two additions in §3.6,
  `index.css`, `router.ts`/`root-route.tsx`, `schema.prisma`, any server/tRPC change.**
  None needed — see §3.7.

## 6. Open questions

The genuinely ambiguous or contestable calls this plan resolved with reasoning rather
than leaving open, flagged here for visibility (most contestable first):

1. **Freeform tag creation allowed by default, not restricted to `suggestions` (§2.6).**
   The issue's "autocomplete against existing tags" phrasing could instead be read as "the
   only valid tags are the existing ones; autocomplete is how you pick one," which would
   make `TagInput` a constrained picker rather than a free-text-plus-suggestions input.
   This plan picked the more permissive reading. If the human intended the restrictive
   one, the fix is contained: change `commitTag`'s no-highlighted-suggestion branch to
   reject (not add) text that doesn't exactly match a `suggestions` entry — a small,
   well-isolated change, not a redesign.
2. **`Badge`'s `accent`/`neutral` variants (§3.1).** The issue asks for "a" display-only
   badge/chip component (singular), which could argue for a single fixed style rather
   than a variant map. Added anyway for consistency with `Button`/`Card`'s established
   variant-map pattern and because it's a small, low-risk addition; trivial to trim to
   `pop`-only if `reviewer-code` prefers strict minimalism against the issue's literal
   wording. **[round 2]** `refiner-notes.md` round 1, finding 3 asked this to be
   reconciled against §5's declined `size` variant rather than left as an unexplained
   asymmetry — see §3.1's added bullet for the reconciliation (reusing existing,
   already-documented color tokens vs. inventing new size tokens nobody asked for).
3. **[round 2 — resolved, kept here for history] `forwardRef` on `TextInput`, removed.**
   Round 1 of this plan added `forwardRef` to the already-merged `text-input.tsx`, plus a
   `useRef`-based `inputRef.current?.focus()` call in `TagInput`, reasoning that a mouse
   click on a suggestion would otherwise move focus to the clicked button. `plan-refiner`
   (round 1, finding 1) correctly caught that this doesn't survive its own earlier
   reasoning: the plan already relies on `onMouseDown={(e) => e.preventDefault()}` on each
   suggestion button, and `preventDefault()` on `mousedown` doesn't just suppress the
   resulting `blur` event as a side effect — per standard, documented DOM behavior
   (confirmed against MDN's `HTMLElement.focus()` documentation and `javascript.info`'s
   "Browser default actions" page: the browser's default `mousedown` action *is* the
   focus-shift to the target element, and `preventDefault()` on `mousedown` cancels that
   default action), it prevents focus from ever moving to the button in the first place.
   Since the input never blurs, the explicit `.focus()` call was very likely dead code,
   and the `forwardRef` plumbing it required served no purpose. **Resolution applied in
   this revision:** the `useRef`, the `.focus()` call, and the `forwardRef` change to
   `text-input.tsx` are all removed (§3.2). `TagInput` now uses `TextInput` exactly as it
   exists on `main`, unmodified — `text-input.tsx` is fully out of this ticket's scope
   (§3.7, §5). The round-1 test that claimed to verify the refocus is also reworded (§4)
   to assert what's actually checkable: that focus never transiently leaves the input
   during a suggestion click, which is the real, distinguishable effect of the
   `preventDefault()` call — not a claim about an explicit `.focus()` call that no longer
   exists.
4. **[round 2, new] `role="option"` wrapping a real, tabbable `<button>` (§3.2).**
   `refiner-notes.md` round 1, finding 2 (non-blocking): this is a minor deviation from
   the strict `aria-activedescendant`/"virtual focus" combobox pattern, where options are
   conventionally not independently focusable. Kept as-is — documented as a deliberate,
   known trade-off (§3.2, §5) rather than a silent gap. A fuller ARIA 1.2 implementation
   is future/richer-combobox-library scope (§2.5).
5. **Case-insensitive dedupe, case-preserving storage (§3.2).** A judgment call made
   without a decided backend collation rule for `Tag.name @unique` (not decided anywhere
   yet). Reasoned as "avoid the obviously-wrong UX of visibly duplicate tags" without
   trying to predict the eventual backend semantics — flagged since #6 could land on a
   different rule (e.g. force-lowercase on storage) that this component doesn't attempt to
   anticipate.
6. **No "browse full list on focus" mode, no wrap-around arrow navigation (§3.2/§5).**
   Both are small, easy, plausible UX enhancements this plan chose not to include, reading
   the issue's scope as narrowly "add/remove tags, autocomplete" rather than a fully
   fleshed-out combobox. Both are additive follow-ups, not blocking gaps.
7. **`MAX_SUGGESTIONS = 8` as a hardcoded internal constant, not an exposed prop (§3.2).**
   No consumer need identified yet for a different cap; easy to promote to a prop later if
   one appears.
8. **Chips-above-input layout rather than a single merged bordered box (§3.2/§5).** A
   reasonable interim visual choice that reuses `TextInput` as-is; a more visually
   integrated chips-inline-with-cursor layout is a plausible future enhancement.

None of these are blocking — each has a stated default and reasoning above.
</content>
