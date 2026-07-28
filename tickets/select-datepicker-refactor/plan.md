# Plan: Component library: refactor Select and Datepicker off native browser widgets (issue #30)

## 1. What "done" means

Issue #30's full text:

> - *Currently* we are using the (ugly) browser defaults for input components.
> - Instead we want to have a designed and fitting custom input appearing when using the
>   date picker or select.

Two sentences, no props/visual spec, no scope boundary on "date picker" (does it mean
just the calendar/date part, or the time-of-day part too?) — same shape as every prior
`ui/` primitive issue, so this plan makes the calls explicit (§2) and flags the genuinely
ambiguous ones as open questions (§7) rather than guessing silently.

Done means, in outline (full detail in §3):

- **`Select`** (`apps/web/src/components/ui/select.tsx`) no longer renders a native
  `<select>`. It's rebuilt as a hand-rolled, keyboard-accessible listbox/combobox widget
  (button trigger + custom-drawn popup list), styled with the existing `field-base`/
  `shadow-input` visual language, so opening it never shows the browser's native
  OS-rendered dropdown.
- **`DateTimePicker`** (`apps/web/src/components/ui/date-time-picker.tsx`) no longer
  renders a native `<input type="date">` for the date field. It's rebuilt as a
  button-triggered custom month-grid calendar popup. The native `<input type="time">`
  for the time field is **kept as-is** — see §2.4 for why "Datepicker" is read as
  date-only scope here, and §7.1 for this being the single most contestable call in this
  plan.
- **`DateRangePicker`** gets the new calendar popup for free by composition (it only
  ever renders two `DateTimePicker`s) — no direct code changes beyond what falls out of
  `DateTimePicker`'s new internal shape, though its tests need re-verification since the
  `min`-guardrail mechanism changes (§2.5).
- Both `DateTimePickerValue`/`DateRangeValue` (the `{date, time?}` / `{start, end}`
  string-based value shapes) and every currently-exposed prop that has a sane new
  equivalent are preserved — see §2.3/§2.6 for the one prop (`Select`'s children API)
  and one behavior (`onChange` payload shape) that can't be preserved unchanged, and why.
- Every touched/new component keeps a colocated `*.test.tsx` covering the edge cases in
  §5, stays registered in the dev-only demo route (`ui-demo-page.tsx`), and
  `components/ui/README.md` gets updated for the two new deviations this ticket
  introduces (§2.2, §2.6).
- No new npm dependency (§2.1). No backend/Prisma/tRPC changes — this is presentational
  only, same boundary every prior `ui/` ticket has drawn. CI (`lint`, `typecheck`,
  `test`, `build`) stays green.

Non-goals in full: §6.

## 2. Context / key decisions

### 2.1 No new npm dependency — reuse the codebase's own hand-rolled combobox precedent

`AGENT_RULES.md` doesn't explicitly forbid new dependencies, but the tech-stack section
is prescriptive and every prior `ui/` ticket (`date-time-picker`, `tag-input-badge`) has
independently verified "no relevant library in `apps/web/package.json`" and built the
widget by hand rather than reaching for one (`tickets/tag-input-badge/plan.md` §2.5:
"No new dependency for the autocomplete UI"). Verified again here:
`apps/web/package.json` has no `@radix-ui/*`, `headlessui`, `react-aria`, `downshift`,
`@floating-ui/*`, `react-day-picker`, `react-datepicker`, or `date-fns`/`dayjs`/`luxon` —
nothing headless-UI or date-math shaped exists in this repo today.

This ticket is a stronger case for reaching for a library than either prior one (a
full keyboard-accessible listbox *and* a full keyboard-accessible date-grid popup is
substantially more ARIA surface than TagInput's single combobox), so it's worth stating
the justification explicitly rather than just following precedent:

- **`Select`**: `apps/web/src/components/ui/tag-input.tsx` already contains a working,
  tested, hand-rolled ARIA-combobox-listbox (draft/open/highlighted-index state,
  `role="combobox"`/`role="listbox"`/`role="option"`, arrow-key highlight movement,
  `onMouseDown` `preventDefault()` to survive the blur-before-click race). `Select` is a
  *simpler* variant of the same pattern (no free-text draft, no filtering, no tag
  chips/removal) — reusing the established in-repo pattern is less net-new code and less
  net-new risk than onboarding a library's API/bundle for a widget this codebase already
  knows how to build.
- **Datepicker**: the value contract (`date: "YYYY-MM-DD"` string) was deliberately kept
  library-free in the original `date-time-picker` ticket (`tickets/date-time-picker/plan.md`
  §2.3: "No date-parsing/formatting library... none is in `apps/web/package.json` today,
  and there's nothing here that needs one"). A calendar grid needs day-of-week/
  days-in-month arithmetic, which is native `Date` object math (`new Date(year, month,
  0).getDate()` for days-in-month, `new Date(year, month, 1).getDay()` for the first
  weekday) — no library needed for that either, and month/weekday *names* come from the
  built-in `Intl.DateTimeFormat` (no hardcoded name arrays to maintain, no library).

If `plan-refiner` or a reviewer disagrees and prefers a small headless date-grid library
for the calendar (the listbox case is comfortably hand-rollable either way), that's a
one-paragraph pushback point, not a full plan rewrite — flagged again in §7.2.

### 2.2 `Select`'s data model: keep JSX `<option>` children, don't switch to an `options` array prop

The current `Select` accepts native `<option>` elements as `children` (`<Select
placeholder="…"><option value="work">Work</option>…</Select>`), which is what lets it
extend `SelectHTMLAttributes` and get option rendering "for free" from the real DOM. Once
`Select` no longer renders a real `<select>`, there are two ways to keep it a useful,
generic widget:

- **(A) Keep the `<option>` children API**, and internally derive the option list by
  walking `children` with `Children.toArray`, reading each element's `value`/`disabled`
  props and its own `children` as the visible label (typed via a narrow internal
  `isOptionElement` guard, not a blind cast). Only plain `<option value="…">Label</option>`
  elements are supported as children — `<optgroup>`, non-`<option>` children, or an
  `<option>` whose own `children` isn't a plain string are explicitly unsupported (not
  silently broken — see §5 for the "renders without throwing" boundary this still needs).
- **(B) Replace with a data-driven `options: { value: string; label: string; disabled?:
  boolean }[]` prop.** Cleaner internally (no `Children` walking/casting), but a real
  breaking API change at every call site.

**Adopted: (A).** The task brief explicitly asks to preserve existing prop APIs where
possible, and (A) means **zero call-site changes** for the two existing demo-page
`<Select>` blocks (`ui-demo-page.tsx` §"Select" section) — they keep working with their
current JSX exactly as written today. The `Children`-walking code is a contained,
well-precedented pattern (this is literally how `React.Children.map` is designed to be
used — walking a fixed, shallow set of typed children — not a fragile hack), and it keeps
`Select` looking and reading like a native `<select>` at the call site, which matters
since this codebase has no other place option lists are modeled. Flagged in §7.3 as the
second most contestable call in this plan, since (B) is the more conventional shape for a
hand-rolled listbox and is trivial to switch to later if a consumer needs richer option
content than a plain string label.

### 2.3 `Select`'s `onChange` payload: breaking change, justified and bounded

The current `Select` forwards a native `ChangeEvent<HTMLSelectElement>` (consumers read
`event.target.value`). A hand-rolled listbox has no native change event to hand back —
fabricating a fake `ChangeEvent`-shaped object purely to preserve that exact signature
(`{ target: { value } }`) would be manufactured complexity for a widget with **zero real
feature-page consumers today** (verified: `Select` is only used in `ui-demo-page.tsx`;
grepped every `.tsx` under `apps/web/src/routes` for `Select` usage and found no
task/event form using it yet). So `onChange` becomes `(value: string) => void` — a plain
string, not an event. This is the one genuinely breaking change in this ticket, and its
blast radius is fully enumerated: `select.tsx` (rewrite), `select.test.tsx` (rewrite),
`ui-demo-page.tsx`'s two `<Select>` call sites (change `onChange={(e) =>
setValue(e.target.value)}` → `onChange={setValue}` if/where the demo is made
controlled — see §3.1). No other file references `Select`'s `onChange`.

### 2.4 Scope boundary: "Datepicker" reads as date-only, not date-and-time

Issue #30 says "date picker," singular, not "date/time picker" — and `DateTimePicker`'s
own file already treats "date" and "time" as two independently-native, independently-
`type="…"` inputs. This plan reads the issue as targeting the *calendar* popup (the
classic "ugly native date picker" complaint — inconsistent OS-rendered calendar UIs
across Chrome/Firefox/Safari) and leaves `<input type="time">` untouched. Reasoning:

- Native time inputs render far more consistently and minimally across browsers than
  native date inputs (typically just three small numeric segments + spinner arrows, no
  full OS calendar popup) — they're a much weaker instance of "ugly browser default."
- A full custom time-of-day picker (hour/minute list or dial, 12h/24h handling) is
  materially separate effort and its own set of keyboard/a11y decisions from a calendar
  grid — bundling it in risks the same "too big, needs its own round" problem the
  original `date-time-picker` ticket was split out for.
- Nothing in `DateTimePickerValue`'s `time` representation (`"HH:mm"`) needs to change
  either way, so descoping it now doesn't foreclose doing it later as a small, additive
  follow-up to this same component.

Flagged as an open question (§7.1), not silently decided — if the human meant "the date
picker" as shorthand for "the whole date+time entry experience," the time input is a
bounded, separable follow-up rather than something this plan blocks on.

### 2.5 Datepicker's value contract and the `min`/`minDate` guardrail: preserved exactly, reimplemented natively

The calendar popup must still produce `value.date` as `"YYYY-MM-DD"` (zero-padded, e.g.
`"2026-07-08"` not `"2026-7-8"`) — this is load-bearing for two things that don't change
in this ticket: `apps/web/src/lib/task-due-date.ts`'s `dueDatePayload` (string
concatenation, `` `${value.date}T${value.time}` ``) and `DateRangePicker`'s
`value.start.date || undefined` lexicographic-min-safe string comparison for the `minDate`
guardrail. Both rely on exact ISO-date string shape and both are **out of scope to
touch** (§6) — the calendar grid's "day clicked" handler is responsible for formatting
into that exact shape (e.g. via `Intl.DateTimeFormat` with `en-CA` locale, which happens
to produce `YYYY-MM-DD`, or manual zero-padding — implementer's choice, either is
zero-dependency).

The `min` **attribute** goes away (it was a native HTML attribute on `<input
type="date">`); `minDate` stays as a prop name and concept but is now enforced by the
calendar grid itself: any day cell whose date string is lexicographically `< minDate` is
rendered `aria-disabled="true"` and non-interactive (both mouse and keyboard). This is a
strictly *stronger* guardrail than before — the native `min` attribute only nudges the
browser's own picker UI and does nothing in JS (per
`tickets/date-time-picker/plan.md` §2.5, "not enforced in JS... a consumer can still
construct/pass an invalid value programmatically"); the new implementation actually
blocks the interaction. That's a behavior change worth calling out even though it's
strictly an improvement — `reviewer-code` should know it's deliberate, not scope creep,
since §2.5 of the original plan explicitly bounded the old guardrail as "minimal, native
HTML only."

### 2.6 Controlled/uncontrolled pattern for `Select`: kept controlled-or-uncontrolled, not forced controlled-only

`components/ui/README.md` currently reserves "controlled-only" for *composite, multi-field*
molecules (`DateTimePicker`/`DateRangePicker`/`TagInput`) specifically because
reconciling internal derived state against an optionally-controlled external value is
real, demonstrated risk for a multi-field value shape. `Select`'s value is a single
scalar string — reconciling `props.value ?? internalState` for one scalar is the exact
same trivial pattern every native form element already does internally (this is not a
new risk category; it's what the browser's own `<select>` does in C++ today, just moved
into JS). So `Select` **stays controlled-or-uncontrolled**: an internal `useState<string>`
seeded once from `defaultValue ?? ""`, with `props.value !== undefined` taking precedence
when supplied — same shape as `defaultValue`/`value` on every other single-native-element
primitive in this directory, just implemented in JS instead of delegated to the DOM.
This preserves the demo page's existing uncontrolled `<Select defaultValue="high">` usage
unchanged.

This also **resolves the mechanical half of `TODO(#26)`** in the current `select.tsx`
(the awkward `defaultValue` fallback exists only to work around React's "don't set
`selected` on `<option>`, use the `<select>`'s own `value`/`defaultValue`" constraint —
once there's no real `<option>`/`<select>` DOM relationship to fight, that specific
workaround has nothing left to work around). The new `select.tsx` will have a normal,
un-hacky `useState(defaultValue ?? "")` with no `TODO(#26)` comment. **Issue #26 itself
stays open and out of scope**, though: #26's broader ask ("require every consumer to
always provide a `defaultValue`/`value`, eliminating the placeholder-vs-value check
entirely, and reconsider how far every component's prop interface should inherit its
native HTML counterpart's full surface") is a cross-component design question titled
generically ("Check form component pattern for prop interface necessities"), not
scoped to `Select` alone — resolving the one concrete symptom it cited isn't the same as
resolving the ticket. Called out explicitly (§6) so this isn't read as silently closing
#26.

### 2.7 Shared popup mechanics between `Select` and the calendar: reuse the TagInput blur trick, no new "click outside" infrastructure

Both new widgets need "open a popup, close it on outside click, don't close it when
clicking something inside it." `tag-input.tsx` already solves exactly this without a
`document`-level listener/`useEffect`/ref pattern: the trigger's `onBlur` closes the
popup, and every interactive element *inside* the popup calls
`e.preventDefault()` in its own `onMouseDown` handler (which suppresses the native
focus-shift-then-blur chain that would otherwise close the popup before the click's
`onClick` fires). Both `Select`'s trigger button and the calendar's trigger button reuse
this exact mechanism — no new "click outside" infra is introduced, keeping the two new
widgets consistent with the one existing precedent instead of adding a second pattern
for the same problem.

Escape closes the popup without changing the value (return focus to the trigger, which
already has it in this button-stays-focused design). Enter/Space commits the
highlighted option/day and closes.

This "trigger stays focused, popup content is navigated via `aria-activedescendant`
rather than real DOM focus" mechanism is the **definitive focus/ARIA model for both new
widgets**, not just `Select` — §3.5 spells out exactly how it's wired onto the calendar
grid specifically (container roles, the day-cell `id` scheme, `tabIndex` on every cell,
where `aria-activedescendant` is set), since a 2D day grid needs more explicit plumbing
than `Select`'s 1D option list to land unambiguously (this was flagged as underspecified
and inconsistent with §3.5's original text in `refiner-notes.md` round 2 — resolved
there in favor of this section's model, not the WAI-ARIA APG grid pattern's roving-
`tabindex` alternative).

## 3. Task breakdown

Two clearly separable workstreams — different files, different widget shape, different
test matrix, no interdependency in code (`DateRangePicker` inherits the calendar for
free but needs no direct edits). Land as two sequential, independently-reviewable chunks
of the same PR/branch (or two PRs if the fix loop finds it easier to reason about
separately — orchestrator's call, not this plan's).

### Phase A — `Select`

**3.1 `apps/web/src/components/ui/select.tsx` (rewrite)**

New prop surface (replaces `extends SelectHTMLAttributes<HTMLSelectElement>`):

```ts
export interface SelectProps {
  children: ReactNode; // <option value="…">Label</option> elements only — see §2.2
  value?: string;       // controlled
  defaultValue?: string; // uncontrolled seed — see §2.6
  onChange?: (value: string) => void; // breaking change from ChangeEvent — see §2.3
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string; // kept for API-compat / label association; currently a pure no-op.
                 // This codebase's forms submit via controlled onSubmit handlers reading
                 // React state (see task-create-form.tsx), never native FormData/
                 // form-native submission, so there's no <input type="hidden"> or other
                 // form-participation logic mirroring this value anywhere internally —
                 // don't assume it's wired up to anything without re-checking this.
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}
```

Structure: a `<button type="button">` trigger (reuses `field-base` + a size-classes
treatment matching `TextInput`'s `md` padding/text-size, plus `ChevronDownIcon` — same
visual footprint as today's `Select` so it doesn't look out of place next to
`TextInput`/`Textarea` at existing call sites) showing the selected option's label or,
when nothing is selected, `placeholder` in the muted `placeholder:text-ink/40` treatment
`field-base` already defines. `aria-haspopup="listbox"`, `aria-expanded`,
`aria-activedescendant` pointing at the highlighted option's id (WAI-ARIA APG "Select
Only" combobox pattern — named for the implementer to reference, not exhaustively
attributed here). Below it, conditionally rendered (only while open), a `role="listbox"`
popup (`absolute`, `border-2 border-ink`, `shadow-hard`, `bg-paper` — same visual
recipe `tag-input.tsx`'s suggestion dropdown already uses) containing one `role="option"
aria-selected={…}` per derived `<option>` child.

Keyboard on the trigger button (works whether or not the popup is currently open,
matching the "Select Only" pattern and `tag-input.tsx`'s existing arrow-key precedent):
`ArrowDown`/`ArrowUp` open the popup if closed and move the highlighted index by one
(clamped to the option list bounds, not wrapping — matches `tag-input.tsx`'s existing
`Math.min`/`Math.max` clamping, so the two widgets behave identically here rather than
introducing a second navigation convention); `Home`/`End` optional nice-to-have, not
required (§6); `Enter`/`Space` commits the highlighted option and closes; `Escape` closes
without changing the value. Disabled `<option>` children are skipped by arrow-key
navigation and unclickable, matching native `<select>` behavior.

Option-derivation helper (module-private, not exported): walks `children` via
`Children.toArray`, keeps only elements whose `type === "option"` (a plain intrinsic
JSX element check, not a custom component type), and reads `.props.value`
(`string`), `.props.disabled` (`boolean`), `.props.children` (asserted/guarded to be a
plain `string` — an `<option>` with non-string children throws a clear dev-time error
rather than silently rendering `"[object Object]"`, since that's a genuine misuse of the
supported API, not a case to silently coerce).

**3.2 `apps/web/src/components/ui/select.test.tsx` (rewrite)**

Full rewrite — the current file asserts native `<select>`/`<option>` DOM (`getByRole
("option", …)`, `select.value`, `fireEvent.change`), none of which exists anymore. New
tests use `getByRole("button", …)` for the trigger, `getByRole("listbox")`/`getByRole
("option", …)` for the (conditionally-rendered) popup, and `fireEvent.click`/
`fireEvent.keyDown` to drive it. See §5 for the specific cases.

**3.3 `apps/web/src/routes/ui-demo-page.tsx` (modified)**

Existing "Select" section's JSX (`<Select aria-label="Choose a tag" placeholder="Choose
a tag…"><option value="work">Work</option>…</Select>`) needs **no structural change**
(§2.2) — the `placeholder`-only example stays exactly as written. The `defaultValue="high"`
example also stays as written (uncontrolled, §2.6). If `reviewer-tests` wants an
explicit *controlled* `Select` demo entry (the file currently has none — both existing
examples are uncontrolled), add one small `useState`-backed example alongside the
`DateTimePicker`/`DateRangePicker`/`TagInput` controlled entries already in this file,
using the new `onChange={(value) => setValue(value)}` signature (§2.3) — not strictly
required by "done" (§1) but cheap and consistent with the file's existing pattern of
demoing both modes where a component supports both.

**3.4 `apps/web/src/components/ui/README.md` (modified)**

Short addition alongside the existing "composite, controlled-only components" bullet:
`Select` is now a hand-rolled listbox (not a thin native wrapper) but **stays**
controlled-or-uncontrolled, unlike the composite family — one sentence pointing at §2.6's
reasoning (single scalar vs. multi-field composite) so a future reader doesn't assume
every non-native-wrapper component in this directory must be controlled-only.

### Phase B — Datepicker (calendar popup inside `DateTimePicker`)

**3.5 `apps/web/src/components/ui/calendar-popup.tsx` (new, internal helper component)**

Not exported from the package's public surface used elsewhere — a `DateTimePicker`-only
implementation detail, same relationship `chevron-down-icon.tsx` has to `select.tsx`
(separate file per this directory's own filename convention, not because it's meant to
be reused standalone yet). Props: `value: string` (`"" | "YYYY-MM-DD"`), `onChange:
(date: string) => void`, `minDate?: string`, `disabled?: boolean`, `"aria-label"?:
string`, `id?: string`.

**Focus/ARIA model — resolved explicitly (this is the round-2 fix; see
`refiner-notes.md`): `aria-activedescendant` on the trigger button, matching `Select`
(§3.1) and `tag-input.tsx`, *not* the WAI-ARIA APG "Date Picker Dialog" grid pattern's
real roving-`tabindex` DOM focus.** §2.7 already establishes "trigger keeps real DOM
focus for the entire open/interact/close lifecycle; popup content is navigated via
`aria-activedescendant`, not `element.focus()` calls" as the shared mechanism for both
new widgets — this is that mechanism's concrete wiring for a 2D day grid specifically
(a 1D option list, per §3.1, needs less explicit plumbing to land unambiguously than a
grid does, which is why this paragraph exists here and not there). The grid is a
*visual* grid — `role="grid"` on the wrapper, `role="row"` on each week, `role="gridcell"`
on each day `<button>` — but it is not a *focus-navigable* one: those container roles
exist purely so assistive tech announces correct row/column grid semantics, independent
of which element in the tree literally holds DOM focus (which, under this model, is
always the trigger button, never a day cell). Concretely:

- Each day cell gets a stable `id`, generated as `` `${gridId}-day-${dateString}` ``
  where `gridId` comes from React's `useId()` called once inside `CalendarPopup` — not
  the consumer-supplied `id` prop, which stays reserved for the trigger button element
  itself, matching `Select`'s and every other primitive's convention in this directory.
- The trigger button carries an `aria-activedescendant` attribute set to
  `` `${gridId}-day-${highlightedDate}` `` whenever `highlightedDate` is set and the
  popup is open (omitted/`undefined` while closed, same as `Select`'s combobox trigger),
  always pointing at the currently-highlighted day cell's `id`.
- Every day-cell `<button>` — in-month, disabled, all of them — is `tabIndex={-1}`. None
  of them is ever a real `Tab` stop; only the trigger button and the two month-nav
  buttons are real tab stops. This is what prevents `Tab`-ing through an open popup from
  stopping at each of the ~28-42 rendered day cells one at a time, which is the concrete
  keyboard-trap failure mode this resolves.
- Arrow keys, `Enter`/`Space`, and `Escape` are all handled by a `keydown` listener on
  the trigger button — the one element that already has real DOM focus throughout the
  interaction (same shape as `Select`'s own `onKeyDown` on its trigger, §3.1), never on
  the day cells themselves. Arrow keys update a `highlightedDate` piece of React state
  and, transitively, the trigger's `aria-activedescendant`; they never call `.focus()`
  on a cell.
- `Escape` closes the popup without changing `value`; because the trigger already holds
  DOM focus (it never left), there's nothing to "return" focus to — this is the same
  no-op-on-close focus behavior §2.7 describes for `Select`.

This deliberately drops the WAI-ARIA APG "Date Picker Dialog" grid-pattern reference this
section previously named for its *focus* handling: that pattern's own focus model is real
roving `tabindex` (exactly one gridcell is a genuine `Tab` stop at a time, and arrow keys
move actual DOM focus cell-to-cell), which is a different, incompatible mechanism from the
`aria-activedescendant` approach above and can't coexist with it. The grid's `role="grid"`/
`role="row"`/`role="gridcell"` *structural* roles are kept (they're still the correct ARIA
shape for a 2D day grid regardless of which focus model drives it), but the pattern's
*focus* half is explicitly not used — full reasoning and the two previously-conflicting
readings this replaces are in `refiner-notes.md`'s round-2 entry.

Structure: `<button type="button">` trigger (same `field-base`-based visual treatment as
`Select`'s trigger, so the two new widgets look like a matched pair) showing the
formatted date (`Intl.DateTimeFormat` — e.g. `"Jul 8, 2026"`) or a muted placeholder
when empty, plus a small calendar-glyph icon (new file, `calendar-icon.tsx`, same
`ChevronDownIcon`-style single-path SVG). Below it, conditionally rendered, a popup
containing:

- A header: `‹ Month YYYY ›` — prev/next-month buttons (native `<button>`, always
  enabled — no minimum/maximum month bound) flanking the current grid's month/year label
  (`Intl.DateTimeFormat(..., { month: "long", year: "numeric" })`).
- A weekday header row (`Intl.DateTimeFormat(..., { weekday: "short" })` for the seven
  labels, generated programmatically off a fixed reference week rather than a hardcoded
  string array).
- A 7-column grid of day cells for the currently-viewed month. **Leading/trailing
  cells (days needed to pad the first/last week out to a full 7-column row) render as
  empty, non-interactive placeholders — not clickable adjacent-month days.** Deliberately
  the simpler of two common calendar UX choices (§7.4): bounds both the implementation
  and the test matrix (no "click a trailing-month day to navigate + select in one
  action" combination to build/test), at the cost of one extra click (navigate month,
  then click the day) for a date near a month boundary. Cheap, well-scoped follow-up if
  a reviewer wants the richer version.
- Each in-month day cell is a `<button type="button" role="gridcell" tabIndex={-1}
  aria-selected={…} aria-disabled={…} id={`${gridId}-day-${dateString}`}>` — role/id/
  `tabIndex` wiring per the focus/ARIA model above. Today's date gets a distinguishing
  visual treatment (e.g. an outline) independent of selection.

Keyboard, deliberately bounded (full list of what's *not* included is in §6, not left
implicit) — all handled on the trigger's `onKeyDown`, per the focus/ARIA model above, so
real DOM focus never moves off the trigger while the popup is open: `ArrowLeft`/
`ArrowRight` move `highlightedDate` by ±1 day, `ArrowUp`/`ArrowDown` by ±7, all **clamped
to the currently-rendered month's in-range days** (no automatic cross-month wrap on
arrow keys — consistent with the "no trailing-month interaction" call above); `Enter`/
`Space` selects `highlightedDate` and closes the popup; `Escape` closes without changing
the value. Month nav buttons are real, separately-focusable `<button>`s reachable by
`Tab` and operated via native click/`Enter`/`Space` — they sit outside the
`aria-activedescendant` scheme entirely (clicking one only changes which month's grid is
rendered/which cell `highlightedDate` may point at; it never moves DOM focus onto a day
cell). Disabled (before-`minDate`) day cells are skipped when computing the next
`highlightedDate` on arrow-key navigation and unclickable, exactly matching `Select`'s
disabled-option treatment (§3.1) for consistency between the two new widgets.

Popup-open/close mechanics reuse §2.7's blur+`onMouseDown preventDefault` pattern,
applied to the trigger button and every clickable cell/nav-button inside the popup.

**3.6 `apps/web/src/components/ui/calendar-popup.test.tsx` (new)**

Direct tests of the calendar in isolation (rather than only exercising it indirectly
through `DateTimePicker`) — see §5 for cases. Tested standalone specifically because its
month-grid arithmetic (days-in-month, first-weekday offset, min-date disabling, month
nav) is real logic worth pinning down independent of `DateTimePicker`'s
toggle/time-field wiring.

**3.7 `apps/web/src/components/ui/calendar-icon.tsx` (new)**

One-path SVG glyph, same shape/props contract as `chevron-down-icon.tsx`
(`SVGProps<SVGSVGElement>` passthrough, `aria-hidden="true"`, `fill="none"`,
`stroke="var(--color-ink)"`).

**3.8 `apps/web/src/components/ui/date-time-picker.tsx` (modified)**

Swap the date field's `<TextInput type="date" .../>` for `<CalendarPopup value=
{value.date} onChange={(date) => onChange({ ...value, date })} minDate={minDate}
disabled={disabled} aria-label={dateLabel ?? "Date"} />`. Everything else in this file
(the "Add time" `Checkbox`, the `<input type="time">` `TextInput`, the `timeOptional`
branching, the controlled-only value/onChange contract, all label props) is **unchanged**
— this is a narrow, single-line-of-JSX swap plus the import change, not a rewrite of the
component. `DateTimePickerValue`'s shape and every existing prop stay exactly as
documented in `components/ui/README.md` today.

**3.9 `apps/web/src/components/ui/date-time-picker.test.tsx` (modified, not rewritten)**

Every existing test that drives the date field via `fireEvent.change(screen.getByLabelText
("Date"), { target: { value: "…" } })` no longer applies — a button-triggered popup isn't
driven by `fireEvent.change` on a text-like input. Those specific assertions (roughly a
third of the file — the ones touching the date field directly; the "Add time" checkbox
and time-field tests are untouched since `type="time"` isn't changing, §2.4) are rewritten
to open the popup (`fireEvent.click` the date trigger button) and click/keydown a day
cell, matching `calendar-popup.test.tsx`'s own interaction style. The `minDate` test
changes from asserting a native `min` **attribute** to asserting the corresponding day
cell renders `aria-disabled="true"` and that clicking/`Enter`-ing it does not call
`onChange` (§2.5).

**3.10 `apps/web/src/components/ui/date-range-picker.test.tsx` (modified, targeted)**

No production-code change to `date-range-picker.tsx` itself, but its tests that assert
the end date's native `min` **attribute** (`toHaveAttribute("min", …)` / its absence)
need the same reinterpretation as §3.9's `minDate` test — assert the corresponding day
cell's `aria-disabled` state on the *end* `DateTimePicker`'s calendar instead. Everything
else in this test file (label composition, `fieldset`/`legend`, disabled propagation,
`timeOptional` behavior) is unaffected since none of it touches the date field's DOM
shape directly.

**3.11 `apps/web/src/routes/ui-demo-page.tsx` (modified)**

No new sections needed — the existing `DateTimePicker`/`DateRangePicker` sections
automatically pick up the new calendar popup once `date-time-picker.tsx` changes (§3.8).
Verify by running the dev server that both demo entries (default `timeOptional`, `false`,
and the range picker's seeded-`minDate` example) still render/interact correctly; no
code change expected here beyond what §3.8 already causes.

**3.12 `apps/web/src/routes/ui-demo-page.test.tsx` (modified, targeted)**

The existing `DateTimePicker`/`DateRangePicker` interaction assertions
(`fireEvent.change` on `getByLabelText("Date")`, etc. — see the existing test named
"...toggle + change events update what's shown") need the same date-field-interaction
rewrite as §3.9 (open popup, click a day). The `Select` demo assertion (§3.2 of the
original `form-primitives` plan's test, now at the line asserting `select.value`) is
rewritten per §3.1/§3.2's new button+listbox shape.

**3.13 `apps/web/src/components/ui/README.md` (modified)**

Addition documenting that `DateTimePicker`'s date field is now a custom calendar popup
(not a native `<input type="date">`), that the time field intentionally still is a native
`<input type="time">` (pointer to §2.4's reasoning so it isn't "fixed" to match later
without re-reading why), and that `minDate`/the range picker's guardrail are now enforced
in JS (grid-cell `aria-disabled`) rather than via a native `min` attribute (§2.5).

**3.14 `apps/web/src/lib/task-due-date.ts`, `apps/web/src/routes/task-create-form.tsx` — verify, don't modify**

`dueDatePayload` and `TaskCreateForm` consume `DateTimePicker` purely through its
`value`/`onChange`/`dateLabel` prop contract, never through its internal DOM shape — no
code change expected here. Called out explicitly as "the one real feature-page consumer
to verify against," not silently assumed unaffected: after §3.8's change, manually
confirm (dev server, `/tasks` create form) that picking a due date via the new calendar
still produces a `"YYYY-MM-DD"` string that `dueDatePayload` turns into the same wire
payload as before.

## 4. Files touched/created (summary)

New:
- `apps/web/src/components/ui/calendar-popup.tsx`, `calendar-popup.test.tsx`
- `apps/web/src/components/ui/calendar-icon.tsx`

Rewritten:
- `apps/web/src/components/ui/select.tsx`, `select.test.tsx`

Modified (targeted, not rewritten):
- `apps/web/src/components/ui/date-time-picker.tsx` (one field swap), `date-time-picker.test.tsx`
- `apps/web/src/components/ui/date-range-picker.test.tsx`
- `apps/web/src/routes/ui-demo-page.tsx`, `ui-demo-page.test.tsx`
- `apps/web/src/components/ui/README.md`

Not touched: `date-range-picker.tsx` (no production code change — composition-only,
§3.10), `index.css`/`field-base` (both new widgets reuse `field-base` for their trigger
buttons; no new Tailwind tokens needed), `task-due-date.ts`, `task-create-form.tsx`
(verified, not modified, §3.14), `package.json`/`package-lock.json` (no new dependency,
§2.1), any Prisma/server/tRPC code, `router.ts`/`root-route.tsx` (demo route already
registered).

## 5. Edge cases and error conditions to cover in tests

**`Select`:**
- Renders trigger button showing `placeholder` text (muted styling) when no
  value/defaultValue is set; placeholder text is *not* also present as a selectable
  option in the popup once opened (it's a prompt, not a real choice — matches the
  native-`Select`'s current `disabled hidden` placeholder-option treatment,
  reinterpreted for the new widget).
- `defaultValue` (uncontrolled): trigger shows that option's label on first render, no
  interaction required.
- `value` (controlled) + `onChange`: clicking the trigger opens the popup; clicking an
  option calls `onChange(optionValue)` exactly once and closes the popup; the trigger's
  displayed label only updates when the consumer feeds the new `value` back in (proves
  it's genuinely controlled, not silently self-managing state that ignores the prop).
- Keyboard: `ArrowDown` from a closed trigger opens the popup and highlights the first
  (or currently-selected) option; repeated `ArrowDown`/`ArrowUp` moves the highlight,
  clamped at the list's ends (no wraparound); `Enter` commits the highlighted option and
  closes; `Escape` closes without calling `onChange` and returns focus/visual state to
  the trigger.
- Disabled `<option>` children are skipped during arrow-key traversal and produce no
  `onChange` call on click.
- `disabled` on `Select` itself: trigger button is `disabled`, cannot be opened via click
  or keyboard.
- `required`: reflected as `aria-required`/equivalent on the trigger (no native `<select
  required>` to rely on anymore — since there's no real form-participating element,
  this is presentational/ARIA only, not enforced against submission; documented as a
  boundary, not a bug).
- `className` merges onto the trigger (matching the old behavior of merging onto the
  `<select>`, not the wrapping `<div>` — same "trigger, not wrapper" precedent).
- An `<option>` whose own children isn't a plain string throws a clear error at render
  (documented misuse, §3.1) — one direct test asserting this, so it's a deliberate
  behavior, not an accidental crash discovered later.
- Renders without throwing given a single `<option>` child and no other props.
- Popup closes and does not call `onChange` when focus leaves the widget entirely (blur
  without a same-target click) — the `tag-input.tsx`-style regression case: assert the
  option button's `onMouseDown` handler calls `preventDefault()` (same "assert the
  directly-checkable lower-level fact, not the full browser focus-shift chain jsdom can't
  simulate" approach `tag-input.test.tsx` already uses, per that file's own comment).

**`calendar-popup.tsx`:**
- Renders trigger showing formatted `value` or a muted placeholder when `value === ""`.
- Opening the popup shows the correct month/year header and the correct number of
  in-month day cells for that month (including a leap-February case — e.g. Feb 2028 has
  29 days, Feb 2026 has 28 — to pin down the days-in-month arithmetic isn't off by one).
- The first day cell aligns under the correct weekday column (a specific known month/
  weekday-offset case, not just "some grid renders").
- Leading/trailing padding cells are present (grid always a multiple of 7) but not
  interactive (no `role="gridcell"`/not clickable/not reachable by arrow-key nav).
- Clicking an in-month day calls `onChange` with the exact `"YYYY-MM-DD"` string
  (zero-padded month/day verified, e.g. day 5 of month 3 → `"…-03-05"`, not `"…-3-5"`)
  and closes the popup.
- Prev/next month buttons re-render the grid for the adjacent month without changing
  `value` (navigating alone doesn't call `onChange`); navigating across a year boundary
  (December → January, January → December) updates the displayed year correctly.
- `minDate`: day cells before it render `aria-disabled="true"`, are unclickable (no
  `onChange` call), and are skipped by arrow-key navigation; the boundary day itself
  (`=== minDate`) is *not* disabled (inclusive bound, matching the old native `min`
  attribute's inclusive semantics).
- Keyboard: arrow keys move the highlighted day (`highlightedDate` state, via
  `aria-activedescendant` on the trigger — §3.5; assert the attribute value, not real
  focus, since real DOM focus never leaves the trigger under this model) within the
  current month's in-range cells, clamped at month edges (no auto cross-month
  navigation, per §3.5); `Enter`/`Space` selects the highlighted day; `Escape` closes
  without calling `onChange`.
- Every day-cell button (in-month, disabled, and padding cells alike, where rendered)
  has `tabIndex={-1}` — assert this directly so a regression that makes cells real `Tab`
  stops (the keyboard-trap failure mode §3.5's focus model exists to prevent) is caught.
- `disabled` on the whole popup: trigger cannot be opened via click or keyboard.
- Today's date gets its distinguishing visual/attribute treatment independent of which
  day (if any) is selected — a fixed-clock test (`vi.setSystemTime` or equivalent) so
  this isn't a flaky, date-dependent assertion.
- `className`/`aria-label`/`id` forwarding onto the trigger.
- Renders without throwing given `value=""` and a no-op `onChange`.

**`DateTimePicker` (targeted re-verification, not a full re-derivation — most of §4 in
the original `date-time-picker` plan is untouched since only the date field's DOM shape
changed):**
- Date-field-specific cases (from the original plan's §4) re-expressed against the new
  popup interaction: default empty state, `onChange` on selecting a day, value preserved
  when only the time changes and vice versa, `minDate` forwarding (now asserted via the
  calendar's `aria-disabled` cells, not a native attribute), `dateLabel` override reaching
  the trigger's accessible name, `disabled` propagation.
- Everything about the "Add time" toggle and the `type="time"` field: **unchanged**, no
  new tests needed beyond what already exists (§2.4 — time field isn't touched).

**`DateRangePicker` (targeted):**
- The `min`-guardrail test(s) re-expressed against `aria-disabled` grid cells on the
  *end* side's calendar (§3.10) — everything else in the existing test file is
  unaffected and left as-is.

**Demo route:** existing render/interaction assertions for `Select`/`DateTimePicker`/
`DateRangePicker` updated to drive the new button+popup interaction shape (§3.12); no new
sections, since no new component is added to the public demo surface (`calendar-popup`
is an internal implementation detail of `DateTimePicker`, not separately demoed — same
relationship `ChevronDownIcon` has to `Select` today, which also isn't separately
demoed).

**Not planned as a dedicated test (documented so `reviewer-tests` doesn't expect it):**
- Real mouse-drag/touch interaction, or anything relying on actual browser layout
  (popup positioning/collision-avoidance against viewport edges) — jsdom doesn't lay out
  elements, and this plan doesn't add viewport-aware positioning logic (§6).
- Native browser calendar/date-picker UI of any kind — there isn't any left to test
  against; that's the entire point of this ticket.
- `Home`/`End`/`PageUp`/`PageDown`/`Shift+PageUp`/`Shift+PageDown` on the calendar grid,
  or type-ahead on `Select` — not implemented (§6).
- Timezone-sensitive behavior — the calendar's day-cell formatting uses the same
  timezone-naive string approach the original `date-time-picker` plan already committed
  to (§2.3 of that plan); nothing new here does `Date`-object timezone math beyond what's
  needed for local calendar-grid layout (day-of-week/days-in-month, which are inherently
  local-calendar operations, not UTC-sensitive ones).

## 6. Explicitly out of scope (scope boundary)

- **The time-of-day input (`<input type="time">`).** Stays native. Reasoned in §2.4;
  flagged as an open question in §7.1 in case the human's intent was broader.
- **`DateRangePicker` production code changes.** Composition-only consumer of
  `DateTimePicker`; picks up the new calendar for free (§3.10). Its same-day
  start-time-vs-end-time-ordering gap and lack of full range validation were already
  out of scope per the original `date-time-picker` plan §5 and remain so here — this
  ticket doesn't touch validation.
- **Wiring `Select` into any real feature form.** No task/event form uses `Select` today
  (verified §2.3); still nothing in this ticket's scope to add one — same "primitive
  first, consumer later" boundary every prior `ui/` ticket has drawn.
- **Cross-month click-to-select in one action** (clicking a grayed trailing-month day).
  Deliberately simplified to blank, non-interactive padding cells (§3.5/§7.4).
- **Full WAI-ARIA APG keyboard coverage** (`Home`/`End`/`PageUp`/`PageDown`/
  `Shift+PageUp`/`Shift+PageDown` on the calendar grid; type-ahead on `Select`). Bounded
  subset only (§3.1/§3.5) — sufficient for basic accessible operation (arrow-key
  traversal, Enter/Escape, disabled-cell skipping) without the full pattern's complete
  surface. Easy, well-scoped, additive follow-up. (This is scoped separately from — and
  is not the same gap as — the round-2 focus-*model* fix in §3.5/§2.7: that fix picks
  which mechanism drives navigation at all; this bullet is about which keys are wired
  once the mechanism is chosen.)
- **Viewport-aware popup positioning** (flipping the popup above the trigger, or
  horizontal collision avoidance, when near a screen edge). Both popups always render
  below/left-aligned to their trigger, same as `tag-input.tsx`'s existing suggestion
  dropdown does today (no positioning logic there either) — consistent with the one
  existing precedent, not a regression this ticket introduces.
- **`Select` multi-select, option groups (`<optgroup>`), or rich (non-plain-string)
  option content.** Not requested; `<option>` children with plain-string labels only
  (§2.2/§3.1).
- **Resolving issue #26 in full.** Only the one concrete symptom it cited
  (`select.tsx`'s `defaultValue`-fallback hack) goes away as a side effect of this
  rewrite (§2.6); the broader cross-component prop-interface question stays open,
  tracked under #26 itself, not folded into this ticket.
- **A `size` variant on either new widget** (matching `DateTimePicker`'s own existing
  "no size variant" boundary). Both trigger buttons always render at `TextInput`'s `md`
  size equivalent.
- **Storybook, visual regression testing, any backend/Prisma/tRPC change.** None needed;
  this is a presentational-only, client-side rewrite of two already-merged
  `components/ui/` primitives.

## 7. Open questions

Most contestable first — none of these block starting the work, each has a stated
default and reasoning above, but they're the calls most likely to come back in a refine
round or review:

1. **Is the native `<input type="time">` in scope? (§2.4)** This plan reads "Datepicker"
   as date-only and leaves the time input native. If the intent was "everything about
   date/time entry should be custom," that's a genuinely separate, additive chunk of work
   (its own calendar-adjacent widget — an hour/minute list or dial — with its own
   keyboard/a11y design), not a small addition to this plan. Flagged for explicit
   confirmation rather than assumed.
2. **No new dependency for the calendar grid (§2.1).** A stronger case than prior
   tickets for reaching for a small headless date-grid library, given the ARIA surface
   involved — this plan still opts to hand-roll it, consistent with every prior `ui/`
   ticket's precedent and this repo's stated preference, but it's the single largest
   chunk of net-new hand-written logic (day-of-week/days-in-month arithmetic, grid
   layout, keyboard traversal) any `ui/` ticket has taken on so far, worth a second look
   if the fix-loop budget gets tight.
3. **`Select`'s `<option>`-children API preserved via `Children` walking, rather than
   switching to a data-driven `options` array prop (§2.2).** Adopted for zero call-site
   churn on the (small, demo-only) existing usage; a data-driven `options` prop is the
   more conventional shape for a hand-rolled listbox and is a moderate, mechanical
   rework (not a redesign) if preferred instead.
4. **Leading/trailing calendar cells are blank, non-interactive placeholders rather than
   clickable adjacent-month days (§3.5).** Bounds scope/tests at the cost of one extra
   click near month boundaries; the richer version is a scoped, additive follow-up.
5. **`Select`'s `onChange` becomes `(value: string) => void` instead of a fabricated
   `ChangeEvent`-shaped payload (§2.3).** A real breaking change, justified by zero
   current feature-page consumers; flagged in case a consumer is planned imminently
   that would prefer the old signature preserved for a smoother migration.
</content>
