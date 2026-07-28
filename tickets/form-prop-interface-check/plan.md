# Plan: Check form component pattern for prop interface necessities (issue #26)

## 1. What "done" means

Issue #26's full text:

> - *Currently* our component inherit the standard HTML props of their HTML
>   counterparts (e.g. Select, Checkbox).
> - We might want to limit that interface to restrict the usage even more.
>   - As an example take the `Select.tsx` component: We need a weird default value/
>     value check to make sure the placeholder we might have provided is there
>   - Instead, we could just require every consumer to provide a defaultValue or
>     placeholder, eliminating this ugly check

This is an audit/design-question ticket, not a "build feature X" ticket — it's phrased
as "check the pattern," with one concrete illustration (`Select`'s placeholder/
`defaultValue` workaround), not a list of required code changes. Done means:

1. Every "thin, single-native-element wrapper" component in `components/ui/`
   (`TextInput`, `Textarea`, `Checkbox`, `Button` — `Select` is excluded, see §2) has
   been checked for a `Select`-style footgun: a place where inheriting the *full* native
   HTML prop surface forces an internal workaround, an ambiguous default, or lets a
   consumer pass a prop that silently breaks the component's own styling/behavior.
2. Every footgun actually found is either fixed as a small, targeted change, or — if
   fixing it would mean stepping outside #26's actual ask (prop *interface* restriction,
   not runtime behavior) — explicitly written up as a deliberate non-fix with reasoning
   (§6), not silently dropped and not silently fixed anyway. This ticket's diff contains
   **no code changes to any component file** (see §3, §4, §6) — the one behavioral
   finding from the audit (`Button`'s `type` default) is documented, not fixed, because
   it isn't a prop-interface problem in #26's sense.
3. The general policy this audit lands on (when a component should extend the native
   HTML attributes interface vs. when it should expose a small curated prop list) is
   written down in `components/ui/README.md`, so the next `ui/` ticket doesn't have to
   re-derive "should this extend `XHTMLAttributes` or not" from scratch.
4. `Select.tsx` itself is **not touched** by this ticket's diff — its concrete
   `defaultValue`/placeholder symptom is already fixed on the unmerged
   `feat/select-datepicker-refactor` branch (PR #40, open, not draft, "ready for
   review"). See §2 for the full reasoning; this is the single most important scope
   call in this plan.

## 2. Scope decision: `Select` is excluded from this ticket's diff

This needs to be explicit and load-bearing, since #26 names `Select` as its one
concrete example and a reviewer could reasonably expect this ticket to touch
`select.tsx`.

**What PR #40 already did to `Select`** (verified via `git show
feat/select-datepicker-refactor:apps/web/src/components/ui/select.tsx` and `git diff
main...feat/select-datepicker-refactor -- apps/web/src/components/ui/select.tsx`):
it rewrites `Select` from `extends Omit<SelectHTMLAttributes<HTMLSelectElement>,
"multiple">` (full native inheritance) to a small, curated `SelectProps` interface
(`children`, `value`, `defaultValue`, `onChange`, `placeholder`, `disabled`,
`required`, `name`, `id`, `className`, `aria-label`, `aria-labelledby` — an explicit
list, not `extends`). The `TODO(#26)` comment and the `defaultValue`-fallback hack it
was attached to are gone entirely, because there's no real `<option>`/`<select>` DOM
relationship left to fight once `Select` is a hand-rolled `<button>` + `role="listbox"`
popup. `select-datepicker-refactor`'s own plan (`tickets/select-datepicker-refactor/plan.md`
§2.6) is explicit that this **"resolves the mechanical half of `TODO(#26)`"** but that
**"issue #26 itself stays open... a cross-component design question... not scoped to
`Select` alone."** `select-datepicker-refactor`'s own `status.md` (on that branch) is
`pr-opened`, i.e. it already went through the implement+review loop, not a
half-finished draft — stronger grounding for leaning on it than "some branch exists
somewhere." PR #40's body says "Closes #30," not #26.

**Decision: this ticket does not touch `select.tsx`, `select.test.tsx`, or the
`Select`-specific bullet PR #40 adds to `README.md`, at all.** Reasoning:

- **The concrete symptom is already fixed**, by a real rewrite already sitting in an
  open, ready-for-review PR. Re-doing or re-touching that work here is redundant at
  best and a guaranteed merge conflict at worst — PR #40 rewrites the entire file
  (extend-native-props signature, JSX body, the whole implementation), so *any* edit
  this ticket made to `select.tsx` (even something as small as tweaking a comment)
  would conflict on nearly every line once one of the two branches merges first.
- **The two tickets are independent in outcome, not just in file overlap.** This
  ticket's actual deliverable — the general policy question — doesn't require
  `Select` as a live example once PR #40 lands; it's fully answered by checking the
  *other* native-wrapper components (§3) and landing the policy in `README.md` at a
  location that doesn't collide with PR #40's own `README.md` insertions (verified via
  `git diff main...feat/select-datepicker-refactor -- apps/web/src/components/ui/README.md`
  — PR #40 inserts two new bullets inside the existing `## Conventions` section; this
  ticket's new content goes in a new `##` section appended at the end of the file,
  after `## Extending an existing component vs. adding a new one` — confirmed to be the
  last section in `main`'s current `README.md` via `git show
  main:apps/web/src/components/ui/README.md | tail -20` — specifically to avoid
  adjacent-line conflicts with those two insertions regardless of merge order).
- **Merge-order independence.** Because this ticket's diff never touches `select.tsx`
  and lands its `README.md` addition in a non-overlapping location, it can merge before
  or after PR #40 with zero conflict either way — the orchestrator/human doesn't need
  to sequence the two PRs relative to each other.

**Residual risk, stated plainly rather than left implicit**: this ticket's claim to
have "meaningfully addressed" #26 partly rests on a *different* ticket's PR (opened for
issue #30, not #26) landing as-is. If PR #40 is significantly reworked in its own
review/fix rounds, or never merges, #26's one named concrete example never actually
gets resolved by anything, and nothing in this ticket's diff surfaces that drift later
(no tracking hook, no re-check). This is accepted as a known limitation, not solved by
this plan — solving it would mean this ticket taking ownership of `Select`, which §2
already argues against.

**Consequence for how this ticket's PR should reference #26 — concrete action, not
prose to remember**: this ticket alone does not fully close #26 in the sense of "every
named example resolved" — `Select`'s specific example is resolved by PR #40, not by
this diff. **At the moment this ticket's PR is opened, run `gh pr view 40 --json
state,mergedAt` first:**
- if it reports `"state": "MERGED"` (i.e. `mergedAt` is non-null) by then, both halves
  of #26 (the concrete `Select` example + the general policy this ticket documents) are
  satisfied, so open the PR with **"Closes #26"**;
- otherwise, open it with **"Refs #26"** (not "Closes #26"), since the concrete example
  is still only fixed on an unmerged branch.

## 3. Investigation: the other native-wrapper components

Read `text-input.tsx`, `textarea.tsx`, `checkbox.tsx`, `button.tsx` in full (current
`main`), plus their tests, plus every call site under `apps/web/src/routes/` (grepped;
current consumers: `task-create-form.tsx` and `task-list-item.tsx`).

- **`TextInput`** (`extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">`) and
  **`Textarea`** (`= TextareaHTMLAttributes<HTMLTextAreaElement>`, no `Omit` at all):
  no `Select`-style footgun found. `placeholder` is natively supported on `<input>`/
  `<textarea>` with no DOM-relationship workaround needed (unlike `<select>`, where
  "placeholder" isn't a real native concept and has to be faked via a disabled hidden
  `<option>` — this is *why* `Select` was uniquely affected and `TextInput`/`Textarea`
  structurally can't have the same class of bug). The one existing `Omit` (`TextInput`'s
  `size`) is already the correct pattern: only `Omit` the specific native prop that
  actually collides with a variant prop of the same name, not a wholesale restriction.
  **No change.**
- **`Checkbox`** (`extends Omit<InputHTMLAttributes<HTMLInputElement>, "type">`): named
  directly in #26's text as a second example of the general "inherits full HTML props"
  pattern, but not as a source of a specific bug. Checked for a `Select`-style
  workaround (controlled/uncontrolled conflict, default-vs-provided-value tension) —
  none found: `checked`/`defaultChecked` are natively exclusive-or-compatible on
  `<input type="checkbox">` with no extra JS layer needed, unlike `<select>`'s
  `<option>`-selection quirk. `checkbox.test.tsx` already has an explicit regression
  test ("forwards arbitrary native input props onto the input, not the wrapper")
  asserting that full pass-through (`id`, `name`, arbitrary attrs) is *intentional,
  tested behavior*, not an oversight. **No change** — documented as a deliberate,
  already-correct instance of the "thin wrapper, full native pass-through" pattern
  in the new README section (§4).
- **`Button`** (`extends ButtonHTMLAttributes<HTMLButtonElement>`, no `Omit`): not
  named in #26, but it's the fourth component following the same "thin native wrapper"
  shape, so it's in scope for the same audit. Found one real, if currently latent,
  issue: `type` is inherited as fully optional with **no explicit default**, so any
  consumer that doesn't pass `type` gets the *native* HTML default of `type="submit"`
  when the `<button>` ends up inside a `<form>` — a classic React/HTML footgun (a
  `<button>` inside a `<form>` silently submits the form on click unless `type="button"`
  is explicit). Verified this isn't live today: `task-create-form.tsx`'s single
  in-`<form>` `Button` already passes `type="submit"` explicitly (intentional), and
  `task-list-item.tsx`'s four `Button`s (Save/Cancel/Edit/Delete) aren't inside a
  `<form>` element at all, so the implicit "submit" default is currently inert.
  **This is a real finding worth recording, but it is not a fix this ticket makes** —
  see §6 for why it's out of scope even though it was found during this audit, and how
  it should be tracked instead.

No other component in `components/ui/` extends a native HTML attributes interface the
way these four (plus, on `main` today, `Select`) do. `Badge`, `Card`, `Panel`,
`Section`, `ChevronDownIcon` were also read directly and **do** each extend a generic
native attributes interface — `card.tsx`: `CardProps extends
HTMLAttributes<HTMLDivElement>`; `badge.tsx`: `BadgeProps extends
HTMLAttributes<HTMLSpanElement>`; `panel.tsx`: `PanelProps extends Omit<
HTMLAttributes<HTMLDivElement>, "title">`; `section.tsx`: `SectionProps extends Omit<
HTMLAttributes<HTMLElement>, "title">`; `chevron-down-icon.tsx`: `(props:
SVGProps<SVGSVGElement>)`. They're excluded from this audit not because they avoid
native inheritance (they don't) but because none of them is a form control — #26's
title and text are specifically about the "form component pattern," and none of these
five participates in form input/value semantics the way `TextInput`/`Textarea`/
`Checkbox`/`Button`/`Select` do, so there's no `Select`-style value/default
reconciliation footgun to even look for on any of them. `TagInput`, `DateTimePicker`,
`DateRangePicker` are the existing "composite, controlled-only" family — already
documented in `README.md` as deliberately *not* following the native-inheritance
pattern (they compose multiple primitives rather than wrapping one native element), so
they're the existing precedent for "curated prop list," not a gap this ticket needs to
fix.

## 4. Task breakdown

**4.1 `apps/web/src/components/ui/README.md`** — append a new `##` section at the end
of the file (after the existing `## Extending an existing component vs. adding a new
one` section, so it doesn't share any lines with PR #40's insertions — see §2):

> ## Prop interface: full native pass-through vs. a curated list
>
> issue #26 asked whether components should keep inheriting their HTML counterpart's
> full prop surface. Audited (`tickets/form-prop-interface-check/plan.md`) — the
> answer differs by component shape, and both shapes are correct in this codebase
> today, not just one:
>
> - **Thin, single-native-element wrappers** (`TextInput`, `Textarea`, `Checkbox`,
>   `Button`, and — as of the `select-datepicker-refactor` ticket — no longer `Select`,
>   see below) should keep extending the native `*HTMLAttributes` interface, `Omit`-ting
>   only the specific prop(s) that actually collide with a variant/custom prop of the
>   same name (e.g. `TextInput` omits native `size: number` because it has its own
>   `size: "sm" | "md"`; `Checkbox` omits `type` because it's hardcoded; `Select`, pre-
>   rewrite, omitted `multiple`). Full pass-through is a *feature* here, not an
>   oversight — consumers get `aria-*`, `name`, `autoComplete`, `pattern`, `min`/`max`,
>   `rows`, etc. for free, and `checkbox.test.tsx`'s "forwards arbitrary native input
>   props" test exists specifically to keep that behavior from regressing.
> - **Composite molecules that compose multiple primitives** rather than wrapping one
>   native element (`DateTimePicker`, `DateRangePicker`, `TagInput`, and — as of
>   `select-datepicker-refactor` — the rewritten `Select`) should expose a small,
>   curated, explicit prop list instead. There's no single native element whose
>   attributes would even make sense to forward, and (per the existing
>   "Composite, controlled-only components" bullet above) reconciling a
>   partially-native, partially-derived internal state against a full native attribute
>   surface is exactly the class of bug `Select`'s pre-rewrite `TODO(#26)` was a small
>   instance of.
> - **This audit found no `Select`-style prop-*interface* footgun in `TextInput`,
>   `Textarea`, or `Checkbox`** — see the plan's §3 for the per-component reasoning.
>   (A separate, non-interface runtime-default question was noted for `Button`'s
>   `type` prop; it's a behavioral default, not a prop-interface restriction, so it's
>   intentionally not addressed by this audit — see the ticket plan §6.)
>
> No component's prop *interface* changed as a result of this audit.

Keeping this as a *new* top-level section (rather than folding it into the existing
`## Conventions` bullet list where PR #40 already inserts content) is deliberate — see
§2's merge-conflict reasoning.

This is the only file this ticket's diff touches. No component source file
(`button.tsx`, `text-input.tsx`, `textarea.tsx`, `checkbox.tsx`, `select.tsx`) is
changed.

## 5. Edge cases and error conditions

- **No component source files are touched by this ticket's diff** — `TextInput`,
  `Textarea`, `Checkbox`, `Button` are all audited (§3) but none needs a code change,
  and `Select` is deliberately excluded (§2). This is worth stating explicitly so
  `reviewer-tests` doesn't go looking for new/updated tests on any component file —
  there are none to check, since there's no behavior change to cover.
- **`README.md` addition is documentation-only** — no runtime edge case, but
  `reviewer-code` should confirm the new section doesn't overlap/conflict with PR #40's
  README insertions at the diff level (verified once at plan time in §2; worth a
  final sanity check against `main`'s actual state at implementation time, in case
  `main` has moved since this plan was written).
- **The `Button` `type`-default finding (§3, §6) must not be silently fixed as a "while
  I'm in there" drive-by during implementation.** Because the fix is small and the
  temptation is real, this is called out explicitly: implement should leave
  `button.tsx` untouched, exactly as scoped in §4/§6, even though the underlying
  observation is real and documented.

## 6. Explicitly out of scope, and why

- **`select.tsx` / `select.test.tsx` / the `Select`-specific `README.md` bullet** — see
  §2. Owned by PR #40, not this ticket.
- **`Button`'s missing `type` default.** Found during this audit (§3): `Button`
  inherits `type` from `ButtonHTMLAttributes` with no explicit default, so an
  unspecified `type` silently falls back to the native `<button>` default of
  `type="submit"`, which would auto-submit an enclosing `<form>` on click. Deliberately
  **not fixed in this ticket**, for two independent reasons:
  - **It's the wrong kind of change for #26.** #26 asks about *prop interface*
    restriction — narrowing what a consumer is allowed to pass, the way `Select`'s
    rewrite eliminates an internal `defaultValue`/placeholder reconciliation hack. A
    `type` runtime default doesn't touch `ButtonProps`'s type signature at all (`type`
    stays `"button" | "submit" | "reset" | undefined`, unchanged) and doesn't eliminate
    any internal workaround — `button.tsx` has none today. It's a runtime-behavior
    footgun, not an interface footgun, so fixing it here would be scope creep relative
    to what this ticket was actually asked to check.
  - **It isn't live anywhere today.** Verified via `grep -n "<form"
    task-list-item.tsx task-create-form.tsx`: `task-create-form.tsx`'s one in-`<form>`
    `Button` already passes `type="submit"` explicitly, and `task-list-item.tsx`'s four
    `Button`s aren't inside a `<form>` at all. So there's no current call site this
    would fix a live bug for.
  - This is written up here rather than silently dropped so the finding isn't lost:
    it's a good candidate for its own small follow-up ticket/issue (opened separately
    from #26, since it's a different class of concern), or for whoever eventually wraps
    `task-list-item.tsx`'s inline-edit fields in a real `<form>` to pick up at that
    point, since the plan's own investigation is that it's currently inert everywhere.
- **Rewriting `TextInput`/`Textarea`/`Checkbox` to a curated prop list "for
  consistency" with the rewritten `Select`/`TagInput`/`DateTimePicker`.** The audit in
  §3 found no bug or footgun in any of these three — a restriction with no concrete
  payoff would only remove real, used pass-through capability (e.g. `id`/`name`/
  `aria-*` forwarding, which `checkbox.test.tsx` already pins as intentional) for the
  sake of "restricting more," which is explicitly framed in #26 as a *question* ("we
  might want to"), not a mandate. §4's README section documents this as a considered
  decision, not a gap.
- **Any change to `date-time-picker.tsx` / `date-range-picker.tsx` / `tag-input.tsx`.**
  These already follow the "curated prop list" pattern this audit endorses (§3, §4)
  and were only read, not touched, to confirm that.
- **No backend/Prisma/tRPC changes** — this ticket is `components/ui/`-only,
  presentational, same boundary as every prior `ui/` ticket.

## 7. Open questions

1. **PR "Closes #26" vs. "Refs #26"** (§2) — resolved as a concrete, mechanical step
   rather than left as something to remember: at the moment this ticket's PR is opened,
   run `gh pr view 40 --json state,mergedAt`; use "Closes #26" if PR #40 has merged by
   then, "Refs #26" otherwise. Not blocking implementation — this only affects the PR
   description, decided at PR-open time, not at plan or implementation time.
