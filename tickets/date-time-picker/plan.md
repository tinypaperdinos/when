# Plan: Component library: date-time picker (issue #16)

_Revised after refiner round 1 — see the sections marked **[round 1]** for what changed
and why. The one blocking finding is addressed in place rather than as an appendix, so
the plan reads as one coherent document._

## 1. What "done" means

Issue #16's full text:

> A date-time picker component, generic and reusable, covering both task due dates
> (single date, optionally with time) and event time ranges (start/end). Called out as
> its own ticket given the complexity relative to the other primitives — likely needs its
> own plan/refine round rather than being bundled with simpler components.
>
> Depends on: Component library setup.

Like #15/#18, this names the goal and its two future consumers but specifies no
props/visual spec/exact component shape — this plan makes those calls explicit (see §2.2
for the biggest one: one component or two).

Done means:

- Two new, generic, presentational, **controlled-only** components exist under
  `apps/web/src/components/ui/`:
  - `DateTimePicker` — a single date, optionally with a time, built by composing the
    already-merged `TextInput` (as `type="date"`/`type="time"`) and `Checkbox` (as the
    "add a time" toggle) rather than introducing new field-well styling or a
    hand-rolled calendar widget.
  - `DateRangePicker` — a start/end pair, built by composing two `DateTimePicker`s
    inside native `<fieldset>`/`<legend>` groups.
- Both have a colocated `*.test.tsx` (Vitest + Testing Library, `fireEvent` — matching
  existing precedent) covering the edge cases in §4.
- Both are registered in the dev-only demo route (`src/routes/ui-demo-page.tsx`) per
  `components/ui/README.md`'s convention, and `ui-demo-page.test.tsx` is extended to
  assert the new sections render *and* are interactive (see §3.5 — these are the first
  demo entries that need local `useState` to be usable at all, since they're
  controlled-only).
- `components/ui/README.md` gets a short addition documenting the one new pattern this
  ticket introduces that nothing existing does: a controlled-only composite component
  built out of other `ui/` primitives rather than a thin wrapper around one native
  element (§2.4).
- No new Tailwind theme tokens (reuses `field-base`/`shadow-input` via `TextInput`, and
  `Checkbox`'s existing styling verbatim), no new npm dependency (no date library — see
  §2.3), no backend/schema/tRPC changes. CI (`lint`, `typecheck`, `test`, `build`) stays
  green.

Non-goals (full list in §5): wiring this into any real task/event form, combining
`date`+`time` into the Prisma/tRPC `DateTime` representation, timezone handling, a
calendar-grid/popover picker UI, start-before-end *validation* (as opposed to the native
`min` guardrail in §2.5), a `size` variant, Storybook.

## 2. Context / what exists today

### 2.1 Established conventions this plan follows

Read `apps/web/src/components/ui/{text-input,textarea,checkbox,select,button}.tsx`,
`components/ui/README.md`, `.claude/AGENT_RULES.md`, and both merged primitive-ticket
plans (`tickets/form-primitives/plan.md`, `tickets/layout-primitives/plan.md`) before
writing this. Conventions reused as-is:

- Filenames kebab-case, PascalCase named export matching the filename, one exported
  component per file (mirrors `select.tsx`/`chevron-down-icon.tsx` being separate files
  even though `ChevronDownIcon` only exists to support `Select`).
- `cn()` (`src/lib/cn.ts`) for class composition — no `clsx`/`tailwind-merge`.
- Border-first visual language, dashed focus ring, `disabled:opacity-50
  disabled:cursor-not-allowed` — all inherited for free here since `DateTimePicker`
  composes `TextInput`/`Checkbox` rather than drawing its own borders/fields (see §2.3).
- Every new component gets a manually-registered section in `ui-demo-page.tsx`.
- Test tooling: Vitest + Testing Library + `fireEvent` (no `user-event`), matching
  `tickets/form-primitives/plan.md` §2.4's explicit precedent.

### 2.2 The one real design decision: two components, not one with a "mode" prop

The issue names one thing ("a date-time picker component") but describes two distinct
value shapes: a single optional-time date (task due date) and a start/end pair of those
(event range). Two ways to model this were considered:

- **One component with a `mode: "single" | "range"` prop.** Rejected: the `value`/
  `onChange` payload shape is fundamentally different between the two modes (`{ date,
  time? }` vs `{ start: {...}, end: {...} }`), which would force a discriminated union
  onto `value`/`onChange`'s types. That complicates the common case (a task form only
  ever needs "single") for a runtime mode-switch nothing needs — no consumer described
  in the issue switches a live instance between single and range at runtime; a task form
  always renders in single mode, an event form always renders in range mode.
- **Two separate, clearly-named components, `DateTimePicker` and `DateRangePicker`,
  where the range one is literally built by rendering two of the single one.** Adopted.
  This mirrors the precedent `tickets/layout-primitives/plan.md` §2.2 already set for
  `Card`/`Panel`: two primitives that share a visual language but differ in *structure*
  are modeled as two components, not one with a variant prop, specifically so the
  distinction stays obvious at the call site rather than hidden behind conditional
  branches inside one component.

This is the single most contestable call in this plan — flagged again in §6.

### 2.3 Value representation: native input value strings, not a date library or a combined ISO string

`DateTimePickerValue` is `{ date: string; time?: string }`, where `date` is whatever
`<input type="date">` produces/accepts (`"YYYY-MM-DD"` or `""`) and `time` is whatever
`<input type="time">` produces/accepts (`"HH:mm"`), with `time === undefined` meaning
"no time chosen" (the time sub-field is hidden/not part of the value at all — see
§3.1). No date-parsing/formatting library (`date-fns`/`dayjs`/`luxon`) is added — none is
in `apps/web/package.json` today (verified), and there's nothing here that needs one:
the component never combines `date`+`time` into a single `Date`/ISO value, never does
timezone math, and never compares dates beyond the one native `min`-attribute guardrail
in §2.5 (a plain string comparison of two `"YYYY-MM-DD"` values, which sorts correctly
lexicographically without parsing).

**Deliberately not producing a Prisma/tRPC-shaped `DateTime` value.** Per
`AGENT_RULES.md`'s "`Date` fields cross the tRPC boundary as plain strings" note, a
future task/event form ticket will need to combine this component's `{ date, time? }`
into whatever string shape the `Entry.dueDate`/`Entry.date` tRPC input expects, handle
the "task has no due date at all" case (this component's value never represents "no date
at all," only "no time" — see §3.1), and decide on a timezone convention. All of that is
real design work that belongs to the ticket that actually builds a task/event form, not
this presentational primitive — same "don't wire it into a real feature" boundary every
other `ui/` primitive ticket has drawn (§5).

### 2.4 Deliberate deviation: controlled-only, not controlled-or-uncontrolled

Every existing form primitive (`TextInput`, `Textarea`, `Checkbox`, `Select`) is a thin
wrapper around exactly *one* native element, so "controlled or uncontrolled" falls out
for free from that one element's own `value`/`defaultValue` semantics — the wrapper adds
no state of its own. `DateTimePicker` is different: it's a composite of two native
inputs plus a derived, non-native piece of UI state ("is the time sub-field currently
shown"), and `DateRangePicker` composes two of those. There's no single native element
whose own `defaultValue` this can delegate to.

Two options: (a) give `DateTimePicker` its own internal `useState` that can optionally
be seeded by a `defaultValue` and kept in sync with an optional controlled `value`, or
(b) make it controlled-only (`value`+`onChange` always required, no `defaultValue`).
This plan picks **(b)**: internal state that has to reconcile against an
optionally-controlled external `value` is exactly the class of bug this codebase's own
history warns about (`select.tsx`'s `defaultValue`-fallback comment and its
`TODO(#26)` already flag a smaller version of this same tension for a single native
element with one extra derived option). For a composite two-field molecule, taking on
that reconciliation problem for a "convenience" uncontrolled mode isn't worth it — a
consuming form (which is a tRPC/React-Query-backed page, per `AGENT_RULES.md`) is going
to hold this value in its own state anyway, so controlled-only costs that consumer
nothing. Documented as an explicit, reasoned deviation from the established pattern (not
an oversight) in both the component's doc comment and a `components/ui/README.md`
addition, so it doesn't get "fixed" back to match the other primitives later without
someone re-reading this reasoning.

### 2.5 Native `min` guardrail on `DateRangePicker`'s end date (small, explicitly bounded)

`DateRangePicker` sets the end `DateTimePicker`'s date input's native `min` attribute to
the current start date value (when non-empty) — a plain HTML attribute the browser
already understands (same category as passing through `required`/`disabled`), not custom
validation logic. This nudges the browser's own date-picker UI to discourage picking an
end date before the start date. **Explicitly bounded, so it isn't mistaken for full
range validation:** it only constrains the *date*, not a same-day start-time vs.
end-time ordering (e.g. start `14:00`/end `13:00` on the same day is not prevented), it's
not enforced in JS (a consumer can still construct/pass an invalid value programmatically
and this component won't complain), and there's no error message/red-border styling —
that fuller validation is explicitly out of scope (§5), matching the precedent
`tickets/form-primitives/plan.md` §5 already set ("validation/error-state styling... not
mentioned in the issue; whichever feature ticket first needs inline validation should
extend these components in place"). Flagged in §6 as easy to drop if `reviewer-code`
considers even this minimal guardrail scope creep.

### 2.6 Accessible naming: sensible defaults, not "consumer must supply" (deviation from `Button`/`Checkbox`)

`Button`'s `icon` variant and `Checkbox` (form-primitives ticket) both landed on
"consumer must supply their own `aria-label`, documented not type-enforced" because
those are single-instance, often-icon-only controls where a codebase-wide default string
wouldn't make sense. `DateTimePicker` always needs *two* accessible names (date + time,
plus the "Add time" toggle's own label when `timeOptional` is on) and `DateRangePicker`
needs the same set doubled (start date/time/toggle, end date/time/toggle) — requiring
every consumer to supply all of them every time is worse ergonomics for comparatively
little gain, and unlike an icon button there's an obviously-reasonable default
("Date"/"Time"/"Add time"). So `dateLabel`/`timeLabel`/`addTimeLabel` (and
`DateRangePicker`'s `startLabel`/`endLabel`) are optional props with defaults —
`dateLabel`/`timeLabel` applied as `aria-label` on the underlying `TextInput`s,
`addTimeLabel` applied as the visible `label` on the underlying `Checkbox` (which is
still that checkbox's accessible name, via the native `<label>` association `Checkbox`
already renders — same "accessible name" category as the other two, just delivered
through visible text instead of `aria-label`). A standalone `DateTimePicker` gets sane
defaults for free; `DateRangePicker` overrides **all three** per side (`"Start
date"`/`"Start time"`/`"Add start time"` and `"End date"`/`"End time"`/`"Add end time"`)
so the two nested instances — including their "Add time" toggles — don't end up with
duplicate, ambiguous accessible names on the same page. Called out explicitly since it's
the reason `DateTimePicker`'s labels are props at all rather than hardcoded strings.

**[round 1, addresses the blocking finding]** The refiner caught that the §3.2 code
sketch composed `dateLabel`/`timeLabel` per side but never touched `addTimeLabel`, so
with `timeOptional={true}` both sides' "Add time" checkboxes would have rendered with
the identical default text — reproducing, for the toggle specifically, the exact
duplicate-accessible-name problem this section argues `DateRangePicker` exists to avoid.
Fixed in §3.2: `addTimeLabel` is now composed the same way as `dateLabel`/`timeLabel`
(derived from `startLabel`/`endLabel`, not a new exposed prop), and §4 adds a test case
asserting the two toggles are independently reachable by distinct label text.

## 3. Task breakdown

### 3.1 `apps/web/src/components/ui/date-time-picker.tsx` (new)

```ts
export interface DateTimePickerValue {
  date: string; // native input[type=date] value: "" | "YYYY-MM-DD"
  time?: string; // native input[type=time] value: "HH:mm"; undefined = no time chosen
}

export interface DateTimePickerProps {
  value: DateTimePickerValue;
  onChange: (value: DateTimePickerValue) => void;
  timeOptional?: boolean; // default true: shows an "Add time" toggle; when false, the
                           // time field is always shown and the toggle is omitted
  dateLabel?: string; // default "Date" — aria-label for the date input
  timeLabel?: string; // default "Time" — aria-label for the time input
  addTimeLabel?: string; // default "Add time" — label for the toggle checkbox
  minDate?: string; // native `min` attribute on the date input (see §2.5)
  disabled?: boolean;
  className?: string; // applied to the wrapping <div>
}
```

Not `extends *HTMLAttributes<...>` like every other primitive — called out since it
breaks that pattern: this isn't a thin wrapper around one native element, so passing
through arbitrary native `<div>` attributes (`onClick`, `data-*`, etc. on a layout
wrapper) isn't the meaningful "pass-through" the other primitives offer. `className` is
kept as the one consumer-facing escape hatch, matching what every primitive's `README.md`
guidance already says about `cn()`.

Structure:

```tsx
<div className={cn("flex flex-col gap-2", className)}>
  <TextInput
    type="date"
    aria-label={dateLabel ?? "Date"}
    value={value.date}
    min={minDate}
    disabled={disabled}
    onChange={(e) => onChange({ ...value, date: e.target.value })}
  />
  {timeOptional !== false && (
    <Checkbox
      label={addTimeLabel ?? "Add time"}
      checked={value.time !== undefined}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.checked) {
          onChange({ ...value, time: value.time ?? "" });
        } else {
          const { time: _drop, ...rest } = value;
          onChange(rest);
        }
      }}
    />
  )}
  {(timeOptional === false || value.time !== undefined) && (
    <TextInput
      type="time"
      aria-label={timeLabel ?? "Time"}
      value={value.time ?? ""}
      disabled={disabled}
      onChange={(e) => onChange({ ...value, time: e.target.value })}
    />
  )}
</div>
```

- `value.time === undefined` is the single source of truth for "no time chosen" —
  checked consistently as `=== undefined` everywhere (not `"time" in value`), so it
  behaves the same whether a consumer omits the key entirely or explicitly passes
  `time: undefined`. Called out so the implementer doesn't use the `in` check, which
  would only handle the "key omitted" case.
- Toggling "Add time" on seeds `time` with `""` (blank), not a guessed default like
  "09:00" — least-surprise default, the user picks their own time.
- Toggling it off removes the `time` key via rest-destructuring rather than setting it
  to `""`/`undefined`-in-place, since `undefined-as-a-present-key` vs. `key-absent` are
  observably different in some contexts (e.g. `"time" in value`, `Object.keys`); removing
  the key is the cleaner "this field doesn't exist right now" representation.
- `timeOptional` default is `true` (documented via a default in the destructured props,
  not `!== false` scattered everywhere — the JSX above writes `timeOptional !== false`/
  `timeOptional === false` only because those are the two render-condition checks;
  the actual prop default is applied once via `{ timeOptional = true, ... }`
  destructuring, same pattern as `TextInput`'s `size = "md"`).
- `disabled` is forwarded to all three sub-controls; no separate wrapper-level disabled
  styling is needed since `TextInput`/`Checkbox` already render their own disabled
  treatment.
- No `size` variant (§5) — sub-inputs always render at `TextInput`'s default `md` size.

### 3.2 `apps/web/src/components/ui/date-range-picker.tsx` (new)

```ts
export interface DateRangeValue {
  start: DateTimePickerValue;
  end: DateTimePickerValue;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  timeOptional?: boolean; // default false: an event's date/time is not optional per
                           // the Entry schema's own comment ("event only: date/time"),
                           // unlike a task's dueDate; overridable if a future consumer
                           // disagrees
  startLabel?: string; // default "Start"
  endLabel?: string; // default "End"
  disabled?: boolean;
  className?: string;
}
```

No separate `startAddTimeLabel`/`endAddTimeLabel` (or similar) props are added to this
interface — **[round 1]** `addTimeLabel` is derived from `startLabel`/`endLabel` the same
way `dateLabel`/`timeLabel` already are, not exposed as its own override. Keeps the prop
surface the same shape it already had; a consumer who wants to change the toggle text
changes `startLabel`/`endLabel` and gets a consistent set of three derived labels per
side, rather than needing to remember a fourth/fifth prop.

Structure:

```tsx
<div className={cn("flex flex-col gap-4", className)}>
  <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
    <legend className="text-sm font-medium">{startLabel ?? "Start"}</legend>
    <DateTimePicker
      value={value.start}
      onChange={(start) => onChange({ ...value, start })}
      timeOptional={timeOptional}
      dateLabel={`${startLabel ?? "Start"} date`}
      timeLabel={`${startLabel ?? "Start"} time`}
      addTimeLabel={`Add ${(startLabel ?? "Start").toLowerCase()} time`}
      disabled={disabled}
    />
  </fieldset>
  <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
    <legend className="text-sm font-medium">{endLabel ?? "End"}</legend>
    <DateTimePicker
      value={value.end}
      onChange={(end) => onChange({ ...value, end })}
      timeOptional={timeOptional}
      dateLabel={`${endLabel ?? "End"} date`}
      timeLabel={`${endLabel ?? "End"} time`}
      addTimeLabel={`Add ${(endLabel ?? "End").toLowerCase()} time`}
      minDate={value.start.date || undefined}
      disabled={disabled}
    />
  </fieldset>
</div>
```

- **[round 1, addresses the blocking finding]** `addTimeLabel={`Add ${(startLabel ??
  "Start").toLowerCase()} time`}` (and the `endLabel` equivalent) is the new line here.
  Default output is `"Add start time"`/`"Add end time"` — distinct, so with
  `timeOptional={true}` the two `Checkbox`es no longer collide on the shared "Add time"
  default the way an unforwarded `addTimeLabel` would have left them. `.toLowerCase()` on
  the label is a small grammar choice (so the composed phrase reads "Add start time"
  rather than "Add Start time" mid-sentence); it only affects the default `"Start"`/`"End"`
  strings and any custom `startLabel`/`endLabel` a consumer supplies — if a consumer's
  custom label depends on its own capitalization being preserved (e.g. an acronym), this
  is a one-line thing to revisit, not something this plan treats as load-bearing.
- `<fieldset>`/`<legend>` used for the native, semantically-correct "label for a group of
  two inputs" — matches this codebase's general preference for native HTML semantics
  over custom ARIA wherever one exists (e.g. `Select`'s native `<select>`+`<option>`
  composition, `Checkbox`'s native `<label>`-wraps-`<input>` association). `border-0 p-0
  m-0` on the `<fieldset>` defensively strips the browser's default fieldset
  border/padding/margin regardless of what Tailwind Preflight already resets, so the
  visual result doesn't silently depend on verifying Preflight's exact fieldset rules.
- `value.start.date || undefined` (not just `value.start.date`) so an empty string
  start date doesn't get passed through as a literal `min=""` on the end date input
  (which would be a no-op but is worth being explicit isn't intended as "block
  everything").
- `timeOptional` is the same prop name/type as `DateTimePicker`'s and is just forwarded
  through unchanged to both sides — a range doesn't need independent time-optionality
  per side.

### 3.3 `apps/web/src/components/ui/date-time-picker.test.tsx` (new)

See §4 for the specific cases.

### 3.4 `apps/web/src/components/ui/date-range-picker.test.tsx` (new)

See §4.

### 3.5 `apps/web/src/routes/ui-demo-page.tsx` (modified)

New `<h2>DateTimePicker</h2>` and `<h2>DateRangePicker</h2>` sections. **These are the
first demo entries backed by local component state**, since both new components are
controlled-only (§2.4) — every existing demo entry uses `defaultValue`/`defaultChecked`
and needs no state. Add two small `useState`-backed wrapper snippets directly in
`UiDemoPage` (not extracted components, matching how the rest of the file is a flat
sequence of `<section>` blocks):

- **DateTimePicker**: one interactive example, `timeOptional` left at its default
  (`true`), starting from an empty `{ date: "" }` value, so a developer running `/dev/ui`
  can actually click "Add time" and see the time field appear — a static/inert demo
  would defeat the purpose of a demo route for this specific component. One additional
  static-ish example with `timeOptional={false}` (still needs its own `useState` to be
  editable) showing the always-both-fields layout.
- **DateRangePicker**: one interactive example seeded with a start date already set (to
  demonstrate the end date's `min` guardrail visually), default `timeOptional` (`false`).

### 3.6 `apps/web/src/routes/ui-demo-page.test.tsx` (modified)

Extend with assertions that the new sections render and are interactive (not just
present) — matching this file's existing "demo route actually shows what it claims"
principle, and specifically exercising the new controlled-state wiring since it's new to
this file: heading present; date/time inputs reachable via `getByLabelText` with their
default labels; `fireEvent.click` on "Add time" reveals the time input; `fireEvent.change`
on a date input updates the rendered `value` (assert via the input's own `.value` after
the change, same pattern `select.test.tsx`'s `ControlledSelect` helper already uses for a
different component).

### 3.7 `apps/web/src/components/ui/README.md` (modified)

Short addition (same treatment as the `shadow-input`/`field-base.ts` note added by
`form-primitives`): a new bullet describing `DateTimePicker`/`DateRangePicker` as
composite components built from other `ui/` primitives (no new field-well styling, no
new tokens) that are **controlled-only**, unlike every other primitive here — with a
one-line pointer to the reasoning (§2.4 of this plan) so it isn't silently "fixed" back
to controlled-or-uncontrolled later without re-reading why.

### 3.8 Files touched/created (summary)

New:
- `apps/web/src/components/ui/date-time-picker.tsx`, `date-time-picker.test.tsx`
- `apps/web/src/components/ui/date-range-picker.tsx`, `date-range-picker.test.tsx`

Modified:
- `apps/web/src/routes/ui-demo-page.tsx`, `ui-demo-page.test.tsx`
- `apps/web/src/components/ui/README.md`

Not touched: `index.css` (no new tokens — reuses `field-base`/`shadow-input` via
`TextInput`), `package.json`/`package-lock.json` (no new dependency), `router.ts`/
`root-route.tsx` (demo route already registered), any Prisma/server/tRPC code
(presentational only — see §2.3 for why combining into the `Entry.dueDate`/`Entry.date`
shape is explicitly deferred).

## 4. Edge cases and error conditions to cover in tests

**`DateTimePicker`:**
- Default (`timeOptional` omitted, `value = { date: "" }`): date input present and
  empty; "Add time" checkbox present and unchecked; time input absent from the DOM
  (not just hidden — asserted via `queryByLabelText`/`queryByRole` returning `null`).
- Checking "Add time" calls `onChange` once with `{ date: <unchanged>, time: "" }`.
- Unchecking "Add time" (starting from a value that already has `time`) calls
  `onChange` with a value whose `time` key is absent (assert `result.time ===
  undefined`, not just falsy).
- When mounted with `value.time` already a defined string (e.g. `"14:30"`), the
  checkbox is checked and the time input is shown and reflects that value, without
  requiring any user interaction first — proves the derived-state approach doesn't
  depend on the toggle having been clicked.
- `fireEvent.change` on the date input calls `onChange` with the new date and the
  previous `time` untouched (including the "no time" case where `time` stays absent).
- `fireEvent.change` on the time input (once shown) calls `onChange` with the new time
  and the previous `date` untouched.
- `timeOptional={false}`: no "Add time" checkbox rendered at all, ever; the time input
  is always rendered, even when `value.time === undefined` (rendered as `""`); its
  `onChange` always sets a `time` key (never removes it, since there's no toggle to
  remove it with).
- `dateLabel`/`timeLabel`/`addTimeLabel` overrides are reachable via `getByLabelText`
  with the custom text, and the corresponding defaults ("Date"/"Time"/"Add time") are
  NOT present when overridden (guards against a copy-paste bug that renders both).
- `disabled`: date input, time input (when shown), and the checkbox are all disabled;
  `fireEvent.change`/`fireEvent.click` on each while disabled does not call `onChange`
  (native browser behavior, same assertion style `Checkbox`/`Select`'s existing tests
  already use for their own disabled cases).
- `minDate` renders as the date input's native `min` attribute.
- `className` merges onto the wrapping `<div>`.
- Renders without throwing given only the minimum required props (`value={{date: ""}}`
  and a no-op `onChange`).

**`DateRangePicker`:**
- Renders two `<fieldset>`s with legends "Start"/"End" (defaults).
- Default `timeOptional` is `false` — no "Add time" checkbox on either side; both time
  inputs always shown. Overriding `timeOptional={true}` shows both toggles and each
  behaves independently (toggling start's doesn't affect end's, and vice versa).
- **[round 1, addresses the blocking finding]** With `timeOptional={true}`, the two
  "Add time" checkboxes have distinct, composed default text — `getByLabelText("Add
  start time")` and `getByLabelText("Add end time")` are both independently reachable
  (two separate elements, not the same node matched twice), and the shared default
  `"Add time"` text is NOT present anywhere in the DOM. This is the direct regression
  test for the bug §2.6/§3.2 call out: without `addTimeLabel` forwarded, both checkboxes
  would render with identical text and this assertion would fail (either because
  `getByLabelText("Add time")` throws on finding two matches, or because the
  "start"/"end"-specific queries find nothing).
- Composed default labels are reachable: `getByLabelText("Start date")`,
  `"Start time"`, `"End date"`, `"End time"`.
- Changing the start date (`fireEvent.change`) calls `onChange` with an updated
  `value.start` and an **unchanged** `value.end` (object-identity-agnostic — compare
  field values, not reference equality, since a new object is expected either way).
  Same check mirrored for changing the end date.
- The end date input's `min` attribute equals the current `value.start.date` when
  non-empty, and is absent (not `min=""`) when `value.start.date === ""` — covers both
  branches of the `|| undefined` guard in §3.2.
- Re-rendering with a new `value.start.date` updates the end date input's `min`
  accordingly (proves it's derived from props on every render, not captured once).
- `startLabel`/`endLabel` overrides propagate into the legend text and all three
  composed labels per side — date, time, **and** the "Add time" toggle (e.g.
  `startLabel="Departs"` → legend "Departs", inputs labeled "Departs date"/"Departs
  time", and (with `timeOptional={true}`) the toggle labeled "Add departs time").
  **[round 1]** the toggle-label assertion is new here — previously this case only
  checked date/time.
- `disabled` disables every sub-control on both sides.
- `className` merges onto the outer wrapping `<div>`.
- Renders without throwing given only the minimum required props (`value={{ start: {
  date: "" }, end: { date: "" } }}` and a no-op `onChange`).

**Demo route:** extended assertions (§3.6) that both new sections render, expose their
default labels, and are genuinely interactive (toggle + change events actually update
what's shown) — not just "renders without throwing," since these are the first
controlled-only, `useState`-backed demo entries in the file.

**Not planned as a dedicated test (documented so `reviewer-tests` doesn't expect it):**
- Any assertion relying on `HTMLInputElement.valueAsDate`/`stepUp`/`stepDown`, or on the
  browser's native calendar/time-picker popup UI — jsdom doesn't render that UI (it's
  headless regardless), and this component never reads those APIs; tests only assert
  plain string `.value` get/set via `fireEvent.change`, matching how every existing test
  in this repo already treats native inputs. **Flagged, not just assumed:** no existing
  component in this repo uses `type="date"`/`type="time"` yet, so there's no established
  precedent that jsdom (v29.x, per `package.json`) round-trips these value formats
  cleanly through `fireEvent.change`. If the implementer hits a jsdom value-sanitization
  quirk (e.g. it rejecting or normalizing a `"YYYY-MM-DD"`/`"HH:mm"` string), that's a
  test-fixture adjustment, not a sign the component is wrong — call it out in the PR
  description if it comes up so `reviewer-tests` isn't surprised by a fixture that looks
  unusual.
- Same-day start-time-vs-end-time ordering on `DateRangePicker` (e.g. start `14:00`/end
  `13:00` same day) — explicitly not implemented (§2.5), so nothing to test.
- Any error-message/red-border validation state — not implemented (§5).
- Timezone-sensitive behavior — the component never interprets its strings as a `Date`
  or does timezone math (§2.3), so there's nothing timezone-related to test.

## 5. Explicitly out of scope (scope boundary)

- **Wiring into a real task/event creation or edit form.** Neither exists yet (verified:
  `apps/web/src/routes/tasks-page.tsx` is a read-only list, no create/edit UI). Same
  "primitive first, consumer later" boundary every prior `ui/` ticket has drawn.
- **Converting `{ date, time? }` (or `{ start, end }`) into the Prisma/tRPC `DateTime`
  string representation**, including the "task has no due date at all" case (this
  component's value always represents "a date is set, optionally with a time" — the
  "no due date at all" toggle is a form-level concern: whether to render a
  `DateTimePicker` instance at all, not something this component's value type
  represents on its own) and any timezone convention. Belongs to the future form ticket
  per §2.3.
- **A calendar-grid/popover date picker.** This ticket wraps the browser's native
  `<input type="date">`/`type="time">` widgets (same "thin wrapper around native
  elements" principle as every other primitive here), not a custom-drawn calendar UI —
  that would be a materially larger, distinct component with its own set of
  keyboard/a11y concerns, not requested by the issue text.
- **Full start/end range validation** (same-day time ordering, an error message, blocking
  an invalid range from being submitted). Only the minimal native `min`-attribute
  guardrail on the date is included (§2.5); the rest is deferred to whichever future
  ticket builds the event form, matching the validation-styling boundary
  `tickets/form-primitives/plan.md` §5 already set for the other primitives.
- **A `size` variant** (`sm`/`md` like `TextInput`/`Button`). Not requested; both new
  components always use `TextInput`'s default `md` size internally. Easy to add later by
  forwarding a `size` prop through to the internal `TextInput`s if a consumer needs it.
- **Uncontrolled mode (`defaultValue`).** Deliberate deviation, reasoned in §2.4 — not an
  oversight.
- **A recurring-date/repeat-rule picker.** Not mentioned anywhere in issue #16; that's a
  distinct, unrequested feature.
- **Dedicated `startAddTimeLabel`/`endAddTimeLabel` override props on
  `DateRangePicker`.** **[round 1]** `addTimeLabel` is derived from `startLabel`/
  `endLabel` (§3.2), matching how `dateLabel`/`timeLabel` are already derived rather than
  exposed as their own props. If a future consumer needs the toggle text to diverge from
  the start/end label independently of date/time (e.g. "Departs" for the legend but
  "Add a specific time" for the toggle), that's a small, additive follow-up (one more
  optional prop per side), not something this ticket blocks on — no such consumer exists
  yet.
- **`components/ui/README.md`'s broader convention text beyond the one addition in
  §3.7, `index.css`, `router.ts`/`root-route.tsx`, any Prisma/server/tRPC change, any new
  dependency.** None needed — see §3.8.

## 6. Open questions

The genuinely ambiguous calls this plan resolved with reasoning rather than leaving
open, flagged here for visibility (most contestable first):

1. **One component vs. two (§2.2).** The issue's singular phrasing ("a date-time picker
   component") could be read as "exactly one exported component, with a range mode,"
   rather than this plan's "`DateTimePicker` + `DateRangePicker`, the latter built from
   the former." This plan's reading leans on the issue's own description of two
   structurally different value shapes and the `Card`/`Panel` precedent for splitting
   structurally-different-but-visually-related primitives into separate components. If
   the human intended one component with a `mode` prop, that's a moderate rework (merge
   the two files, add a discriminated `value`/`onChange` union) rather than a full
   restart, but it's the one call most likely to come back in a refine round.
2. **Controlled-only, no `defaultValue` (§2.4).** A real deviation from every other
   primitive's controlled-or-uncontrolled pattern. Reasoned as deliberate given the
   composite-value/derived-state problem it would otherwise create, but flagged since
   it's a genuine API inconsistency across `components/ui/` if someone expects every
   primitive to support both modes.
3. **The `min`-attribute guardrail on `DateRangePicker` (§2.5).** Not requested by the
   issue text; added as a small, native-HTML-only nudge. Trivial to remove
   (`minDate={value.start.date || undefined}` is one line at one call site) if
   `reviewer-code` considers it scope creep beyond "generic and reusable... covering
   event time ranges."
4. **Default `timeOptional` values (`true` for `DateTimePicker`, `false` for
   `DateRangePicker`).** Reasoned from the `Entry` schema's own field comments (`dueDate`
   is explicitly "task only: optional due date"; `date` is "event only: date/time" with
   no separate optionality noted), but these are still judgment calls about a schema
   this ticket doesn't touch, not something the issue states outright.
5. **[round 1]** **`.toLowerCase()` on `startLabel`/`endLabel` when composing
   `addTimeLabel` (§3.2).** A small wording judgment call (so the default reads "Add
   start time" rather than "Add Start time"), not requested by anything — flagged in
   case `reviewer-code` prefers the un-lowercased, more mechanically-consistent
   composition to match how `dateLabel`/`timeLabel` are composed (no case
   transformation there). Trivial to change either way; doesn't affect the distinctness
   the blocking finding was actually about.

None of these are blocking — each has a stated default and reasoning above.
</content>
