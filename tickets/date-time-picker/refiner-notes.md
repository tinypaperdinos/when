# Refiner notes — date-time-picker

## Round 1

Verified `ticket.md` against the live issue (`gh issue view 16 --repo tinypaperdinos/when`)
— the plan's §1 quote is verbatim, no drift. Cross-checked the plan against
`text-input.tsx`, `checkbox.tsx`, `select.tsx`, `components/ui/README.md`, and
`ui-demo-page.tsx` for fit with existing conventions.

### Blocking

1. **`addTimeLabel` isn't forwarded from `DateRangePicker` to its two nested
   `DateTimePicker`s, contradicting the plan's own §2.6 reasoning.** §2.6 explicitly
   argues that `DateRangePicker` must override `dateLabel`/`timeLabel` per side "so the
   two nested instances don't end up with duplicate, ambiguous accessible names on the
   same page" — but the §3.2 code sketch only composes `dateLabel`/`timeLabel`
   (`` `${startLabel ?? "Start"} date` `` etc.) and never touches `addTimeLabel`. When a
   consumer sets `timeOptional={true}` on `DateRangePicker` (the plan's own demo-route
   example even flips this on for the interactive `DateTimePicker` case, and §4 lists
   "Overriding `timeOptional={true}` shows both toggles" as a required test), both the
   start and end `Checkbox`es render with the same default visible/accessible text ("Add
   time") — exactly the duplicate-name problem §2.6 says it's solving for the other two
   labels, just left unfixed for this one. It's also invisible in the test plan: §4's
   `DateRangePicker` cases test `dateLabel`/`timeLabel` composition but never assert
   anything about the two checkboxes' labels being distinct, so this would ship
   unnoticed if the implementer follows the pseudocode as written. Fix is small and
   contained to §3.2 (e.g. thread through `addTimeLabel` the same way `dateLabel`/
   `timeLabel` are composed, or introduce `startAddTimeLabel`/`endAddTimeLabel`) plus one
   more test case in §4 — not a rework, but real enough that an implementer building
   from this pseudocode verbatim would reproduce the bug the plan explicitly said it was
   avoiding.

### Non-blocking observations (worth a look, not gating approval)

2. **No `required`/other native-attribute passthrough on `DateTimePickerProps`.** §3.1
   deliberately doesn't `extend *HTMLAttributes` (reasoned: this is a composite, not a
   thin single-element wrapper, so "pass through arbitrary native attributes" doesn't
   have one obvious target element). That reasoning holds, but it does mean a future
   form ticket that wants native `required` on an event's date input (per the `Entry`
   schema's `date` field being non-optional for events) has no way to set it through this
   component and would have to extend the props later. Not a gap in *this* ticket's
   scope (no consumer exists yet to need it), just flagging so it isn't treated as an
   oversight when the form ticket runs into it.
3. **Focus behavior when the time field mounts/unmounts via the "Add time" toggle isn't
   discussed.** Toggling the checkbox conditionally renders/removes the time `TextInput`
   (§3.1's JSX). Not asserting anything is wrong here — jsdom/Testing Library tests won't
   surface a real focus-loss issue the way a manual keyboard-only pass might — just
   noting it's untested and unmentioned; low risk given this is a controlled, always-
   revisitable toggle, not worth adding scope for.

### What's solid

- Ticket fidelity: the plan's "done means" (§1) matches issue #16's actual scope —
  neither under- nor over-scoped. The explicit non-goals list (§5) correctly excludes
  form wiring, DateTime-string conversion, timezone handling, calendar-grid UI, full
  range validation, and a `size` variant — none of those are requested by the issue, and
  the plan gives a specific reason for each exclusion rather than a blanket "not now."
- The two-components-vs-one-with-a-mode-prop call (§2.2) is well-reasoned, grounded in a
  real precedent (`Card`/`Panel` in `layout-primitives`), and honestly flagged as the
  most contestable call rather than smuggled in — appropriate to leave as a documented
  judgment call, not something the plan needs to resolve via a stub proving both
  directions.
- Controlled-only deviation (§2.4) is a genuine, reasoned departure from the rest of
  `components/ui/`'s controlled-or-uncontrolled pattern, and it's documented as a
  deviation (component doc comment + README addition) rather than left to be
  "corrected" by a future contributor who doesn't know why it's different — good call
  given the composite-value reconciliation problem it would otherwise create.
- Value representation (§2.3: plain native input-value strings, no date library, no
  combined `Date`/ISO value) matches `AGENT_RULES.md`'s tRPC-string-boundary note and
  correctly avoids introducing a new dependency for work this ticket doesn't need to do.
- Test coverage (§4) is thorough on the actual state-machine edge cases that matter here
  (derived-state-without-interaction case, `undefined`-vs-`""`-vs-key-absent for `time`,
  both `min`-attribute branches, disabled propagation, label overrides hiding rather than
  duplicating defaults) and honestly scopes out what jsdom can't meaningfully test
  (native date/time picker popup UI) rather than silently skipping it.
- Fits existing conventions: kebab-case filenames, `cn()`, composing `TextInput`/
  `Checkbox` rather than hand-rolled field styling, manual demo-route registration,
  README addition for the one new pattern — no new pattern introduced without
  justification.

VERDICT: REVISE

## Round 2

Re-verified `ticket.md` against the live issue (`gh issue view 16 --repo tinypaperdinos/when`)
— still verbatim, no drift introduced by the revision. Focused primarily on the round-1
blocking finding and swept the rest of the plan for anything the fix might have disturbed.

### Round-1 blocking finding: confirmed fixed

`addTimeLabel` is now threaded through `DateRangePicker`'s §3.2 code sketch exactly as
`dateLabel`/`timeLabel` already were:

```
addTimeLabel={`Add ${(startLabel ?? "Start").toLowerCase()} time`}
```
(and the `endLabel` equivalent). Default output is `"Add start time"` / `"Add end time"`
— two distinct strings, so with `timeOptional={true}` the two `Checkbox`es no longer
collide on the previously-shared `"Add time"` default. Traced this through
`checkbox.tsx`: `label` is rendered as visible text inside the `<label>` that wraps the
native `<input type="checkbox">`, so it genuinely is that checkbox's accessible name (not
just visible text) — the fix addresses the actual a11y problem, not just a cosmetic one.

§4 now carries a direct regression test for this: `getByLabelText("Add start time")` and
`getByLabelText("Add end time")` independently reachable as two separate elements, plus
an assertion that the old shared default `"Add time"` is absent from the DOM entirely.
The `startLabel`/`endLabel`-override test case (§4) was also extended to assert the
toggle label follows the override, not just date/time — closing the gap where a custom
label could theoretically re-introduce the same collision if `addTimeLabel` composition
were skipped for the override path. This is exactly the fix + regression test the round-1
finding asked for; I don't see a way for an implementer following this pseudocode to
reproduce the original bug.

No new issue introduced by the fix itself: `addTimeLabel` is passed unconditionally to
both `DateTimePicker` instances regardless of `timeOptional`, which is harmless (the
child only renders the checkbox — and thus only consumes the label — when
`timeOptional !== false`).

### Continued review (round 2, full pass)

No new blocking findings. Re-checked the areas most likely to have shifted:

- **Scope fidelity**: unchanged from round 1 — still matches issue #16 exactly, no
  under/over-scoping. `gh issue view 16` body confirmed identical to the plan's §1 quote.
- **§2.4 controlled-only deviation**: cross-checked against `select.tsx`'s actual
  `TODO(#26)` comment (read directly) — the plan's characterization of that precedent is
  accurate, not a stretched analogy.
- **§3.1/§3.2 composition**: re-read `checkbox.tsx`/`text-input.tsx` against the code
  sketches — `aria-label` on `TextInput` and `label` on `Checkbox` are both real,
  correctly-targeted accessible-name mechanisms for the underlying native elements; no
  mismatch between what the plan claims and what the components actually do.
- **Non-blocking observations from round 1** (no `required` passthrough, untested focus
  behavior on toggle mount/unmount) were correctly left as non-blocking and don't need
  re-litigating — nothing in the round-1 fix changed their calculus.
- **Open questions (§6)**: the new item 5 (`.toLowerCase()` on composed labels) is a
  genuinely trivial, reversible wording call, correctly flagged as non-blocking rather
  than smuggled in as settled fact.

This plan is ready to build from.

VERDICT: APPROVED
