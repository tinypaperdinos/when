# Refiner notes: select-datepicker-refactor

## Round 1 — REVISE

Verified against `gh issue view 30` (full text: two bullets, "designed and fitting
custom input... when using the date picker or select") and `gh issue view 26`
("Check form component pattern for prop interface necessities" — still open, generic,
not `Select`-specific). Also spot-checked the plan's factual claims against the actual
codebase (`select.tsx`, `tag-input.tsx`, `date-time-picker.tsx`, `date-range-picker.tsx`,
`README.md`, `ui-demo-page.tsx`, existing test files, `task-create-form.tsx`'s submit
pattern) — every concrete claim I checked (zero non-demo `Select` consumers, the
`min`-attribute assertions in the existing test files, the controlled-only composite
convention in the README, forms submitting via `onSubmit` handlers rather than native
`FormData`) held up. This is a well-researched, honest plan — the issue below is
substantive, not a rubber-stamp complaint, and is the reason for REVISE rather than
APPROVED.

### Resolving the three flagged open questions (§7) — my calls, not just relaying them back

1. **§7.1 — is `<input type="time">` in scope?** **Confirm the plan's call: out of
   scope.** Issue #30 says "date picker," and the issue's own title enumerates "Select
   and Datepicker" as the two targets — it does not say "date/time picker," and the
   existing component's own value shape already treats date and time as two
   independently-`type=` native inputs. Native `<input type="time">` is also a
   materially weaker instance of "ugly browser default" than a full OS calendar popup
   (three numeric segments, not a whole rendered UI). Scoping it out, documented as a
   bounded/additive follow-up, is the right call. Agreed.

2. **§7.3/§2.3 — `Select`'s `onChange` becomes `(value: string) => void`, a breaking
   change from `ChangeEvent`.** **Confirm: correct call.** Verified independently
   (`grep -rln "from.*ui/select|<Select" apps/web/src`) that `Select` has zero
   feature-page consumers — only `ui-demo-page.tsx` and its own files reference it.
   Fabricating a fake `ChangeEvent`-shaped object to preserve a signature nothing
   real depends on would be manufactured complexity. Ship the breaking change as
   planned; blast radius is genuinely fully enumerated.

3. **§7.4/§2.5 — `minDate` moves from a native `min` attribute to JS-enforced
   `aria-disabled` grid cells.** **Confirm: correct, and actually a strict
   improvement**, as the plan itself notes (the old native `min` never blocked
   programmatic/invalid values in JS). No objection. One gap below (see "Blocking
   finding") in *how* that enforcement interacts with the grid's focus model, but the
   decision to move enforcement into JS is right.

### Dependency sanity check (the question I was specifically asked to interrogate)

The "no new npm dependency" call (§2.1) is directionally right and consistent with
strong, twice-repeated precedent (`date-time-picker`, `tag-input-badge`) — I'm not
requiring a library be added. But the plan's confidence that hand-rolling this is
comfortably *lower risk* than a headless library is not fully earned by what's actually
specified in §3.5, for the reason below: the plan is vague on exactly the part
(grid focus/ARIA semantics) that a library like `react-day-picker` or `react-aria`
would get right by construction, and that gap would not exist if a library had been
adopted. This doesn't mean "reach for a library" — it means §3.5 needs to close the gap
before an implementer starts, because right now two different implementers would build
two different (and differently-broken) focus models from the same prose.

### Blocking finding: the calendar grid's focus/ARIA model is underspecified, and the two plausible readings are both partially wrong

§3.5 names "WAI-ARIA APG 'Date Picker Dialog' grid pattern" as the reference, but that
pattern's actual focus model is **roving `tabindex`**: exactly one gridcell is
`tabIndex={0}` (the currently-highlighted day) and all others are `tabIndex={-1}`; real
DOM focus moves cell-to-cell as arrow keys are pressed. §2.7, however, says the calendar
reuses `Select`'s "button-stays-focused" mechanism verbatim ("Escape... return[s] focus
to the trigger, **which already has it in this button-stays-focused design**"), which is
the *other* WAI-ARIA pattern — `aria-activedescendant` on a single always-focused
control (this is what `Select`'s combobox-listbox and `tag-input.tsx`'s combobox
correctly do, because those are single-line, one-dimensional lists).

The plan asserts both at once without reconciling them, and the concrete details that
would disambiguate are missing:

- No `role="grid"`/`role="row"` container is specified — §3.5 only says each day cell is
  `role="gridcell"`. A bare `role="gridcell"` with no `role="grid"` > `role="row"`
  ancestor is invalid ARIA structure (assistive tech won't announce grid navigation
  semantics correctly either way this is resolved).
- If the intended model is "trigger stays focused, cells highlighted via
  `aria-activedescendant`" (matching §2.7's stated mechanism and `Select`'s pattern),
  §3.5 never says the trigger button carries `aria-activedescendant` pointing at the
  highlighted cell's `id`, nor gives the cells an `id` scheme to point at (unlike §3.1,
  which explicitly specifies this for `Select`: "`aria-activedescendant` pointing at the
  highlighted option's id").
- If the intended model is real roving focus on `<button role="gridcell">` elements
  (which the "day cell is a `<button>`" framing suggests), the plan never says those
  buttons need `tabIndex={-1}` except for the one currently highlighted. Without that,
  every rendered day cell (up to ~42 with padding, ~28-31 without) is a naturally
  tabbable `<button>`, and `Tab`-ing through an open calendar popup would stop at every
  single day before reaching anything past it — a real, user-visible keyboard trap /
  unusable tab order, not a hypothetical.
- "Month nav buttons are reachable by `Tab`... not part of the grid's roving-highlight
  scheme" (§3.5) uses "roving-highlight," which reads as the activedescendant model, but
  never says so explicitly, and never states whether the day-cell buttons themselves are
  excluded from `Tab` order (they must be, under either correct model, but the plan
  doesn't say it).

This is architecture, not polish: whichever model is chosen changes what the
implementation code looks like (whether arrow-key handling calls `cellRef.current
.focus()` vs. just updates `highlightedIndex` state), what §3.6's tests need to assert
(focus vs. `aria-activedescendant`), and whether `minDate`-disabled cells need `disabled`
(removes from focus entirely) vs. `aria-disabled` + a keydown guard (stays reachable but
inert) — the plan currently specs the latter (§2.5: "`aria-disabled` and non-interactive
(both mouse and keyboard)") but that phrasing is only fully coherent under the
activedescendant model; under a real roving-focus model, a disabled cell either needs
`tabIndex={-1}` permanently (never becomes the roving stop) or the roving-focus logic
needs to explicitly skip it when computing the next stop, which isn't spelled out either.

**Required before implementation starts:** §3.5 needs one explicit paragraph picking one
model — recommend `aria-activedescendant` with the trigger button retaining focus,
since that's what §2.7 already says and what keeps the calendar mechanically consistent
with `Select`'s widget (same popup-close/blur trick, same "trigger captures all
keydowns" shape, no new focus-management pattern in the codebase) — plus:
`role="grid"` wrapping `role="row"` wrapping the `role="gridcell"` buttons, an id scheme
for cells, `aria-activedescendant` wired on the trigger, and `tabIndex={-1}` on every day
button (they're never real `Tab` stops; the trigger drives navigation entirely). This is
a small, mechanical addition to spec, not a redesign — flagging it now because it's the
one place in an otherwise very thorough plan that's vague exactly where §1 of this
review's brief says to look, and because it's the load-bearing piece of "does hand-
rolling this actually carry the low risk the plan claims."

### Non-blocking notes (don't need a re-plan, just worth the implementer/reviewer knowing)

- **`name` prop on the new `Select`** (§3.1) is documented as accepted but "not
  otherwise consumed internally" (no hidden `<input type="hidden">` mirroring it into
  native form semantics). Verified this is fine given this codebase's pattern: every
  form (`task-create-form.tsx` checked directly) submits via a controlled `onSubmit`
  handler reading React state, never native `FormData`/form-native submission — so an
  inert `name` prop costs nothing today. Just make sure the doc comment says it's
  currently a no-op (the plan already implies this; make it explicit in the code
  comment, not just the plan prose), so a future reader doesn't assume it's wired up.
- **`required` on the new `Select`** is correctly flagged (§5) as presentational-only
  now that there's no real form-participating element — correct call, already
  self-documented as a boundary rather than a silent gap. No further action needed.
- Everything else checked out on re-derivation: the "zero `Select` consumers outside the
  demo page" claim, the existing tests' `toHaveAttribute("min", …)` assertions in both
  `date-time-picker.test.tsx` and `date-range-picker.test.tsx` (confirmed these exist
  exactly where §3.9/§3.10 say they do and need the described rewrite), and the
  controlled-only composite convention described in `components/ui/README.md` (matches
  §2.6's characterization exactly).

### Scope fidelity / over- and under-scoping

No under-scoping found relative to the two-bullet issue text — if anything the plan is
unusually thorough for how thin the source issue is, but that thoroughness matches this
repo's established `ui/` ticket precedent (colocated tests, demo-page registration,
README updates), not gratuitous scope inflation. No over-scoping found either: the
`minDate` JS-enforcement strengthening is a necessary side effect of removing the native
attribute (not an elective feature add), and the plan is explicit and self-aware about
the one deliberate side-scope resolution it does take (closing the mechanical half of
#26) versus what it correctly leaves alone (the rest of #26, `DateRangePicker`
validation gaps, wiring `Select` into a real form). Good hygiene throughout §6.

VERDICT: REVISE

## Round 2 — APPROVED

Scope per `AGENT_RULES.md`'s re-review rule: verifying only the round-1 blocking finding
(calendar grid focus/ARIA model) and the non-blocking `name`-prop fix. Not re-auditing
scope fidelity, dependency choice, or the three previously-resolved open questions —
already validated in round 1 and untouched this round.

### Blocking finding from round 1 — verified resolved

Re-read §2.7 and §3.5 in full, and grepped the whole plan for every remaining
`APG`/`roving`/`tabindex`/`activedescendant`/`role="grid|row|gridcell"` occurrence to
confirm no stale reference to the old (incompatible) reading survives anywhere else in
the document. Findings:

- **One model, stated once, referenced consistently everywhere else.** §3.5 now commits
  explicitly to `aria-activedescendant` on the trigger button, names the WAI-ARIA APG
  "Date Picker Dialog" grid pattern's real roving-`tabindex` focus half as the
  *rejected* alternative (not silently dropped — actively called out as incompatible and
  why), and keeps only that pattern's *structural* roles (`role="grid"` wrapper /
  `role="row"` per week / `role="gridcell"` per day button). Every other place in the
  plan that touches this (§2.7's own description of the shared mechanism, the `Structure:`
  bullet list's `<button role="gridcell" tabIndex={-1} ...>` markup, the `Keyboard`
  paragraph, and §5's test list) agrees with this single model — I didn't find a
  surviving passage that implies real DOM focus ever leaves the trigger.
- **id scheme is concrete and collision-safe.** `` `${gridId}-day-${dateString}` ``,
  `gridId` from a single `useId()` call scoped to `CalendarPopup`, explicitly *not* reusing
  the consumer-supplied `id` prop (which stays reserved for the trigger, matching every
  other primitive's convention in this directory per the plan's own cross-reference).
  This directly closes the round-1 gap ("§3.5 never says the trigger button carries
  `aria-activedescendant`... nor gives the cells an id scheme").
- **The keyboard-trap failure mode is explicitly named and closed.** "Every day-cell
  `<button>` — in-month, disabled, all of them — is `tabIndex={-1}`... only the trigger
  button and the two month-nav buttons are real tab stops," with the exact bad outcome
  it prevents spelled out ("`Tab`-ing through an open popup from stopping at each of the
  ~28-42 rendered day cells one at a time"). This is the specific gap round 1 called "a
  real, user-visible keyboard trap... not a hypothetical" — now closed by an explicit rule,
  not left to implementer inference.
- **The `minDate`/disabled-cell incoherence is resolved as a side effect.** Round 1 flagged
  that `aria-disabled` + "non-interactive (both mouse and keyboard)" (§2.5) was only
  coherent under the activedescendant model, not under real roving focus. Now that the
  model is unambiguously activedescendant, "skipped when computing the next
  `highlightedDate` on arrow-key navigation and unclickable" (§3.5's Keyboard paragraph)
  is fully self-consistent — no `disabled`-vs-`tabIndex`-management ambiguity left.
- **Escape/focus-return is coherent.** "Because the trigger already holds DOM focus (it
  never left), there's nothing to 'return' focus to" — this only makes sense once the
  model is pinned down, and it now reads as a direct, unambiguous consequence of the
  stated model rather than an assertion riding on an unresolved contradiction.

I did not find a second, conflicting reading surviving anywhere in the document. An
implementer reading §2.7 + §3.5 top to bottom would build one focus model, not two.

### Non-blocking observations (do not require another round)

- **Header row (`‹ Month YYYY ›` and the weekday-label row) isn't assigned an explicit
  ARIA role** (e.g. a `role="row"`/`role="columnheader"` treatment for the weekday
  labels, to sit correctly under the `role="grid"` wrapper alongside the day-of-week
  rows). The plan already scopes out "Full WAI-ARIA APG keyboard coverage... sufficient
  for basic accessible operation" (§6), so treating full grid-header conformance as
  outside that same bounded-subset philosophy is consistent, not an oversight worth
  blocking on — but worth a one-line implementer note if `reviewer-code` wants to be
  thorough, since it's a cheap addition once the rest of the structure exists.
- **Initial `highlightedDate`/displayed month on a plain trigger *click* (as opposed to
  opening via `ArrowDown`) isn't stated.** §5's `Select` test list spells this out for
  the listbox ("`ArrowDown` from a closed trigger opens the popup and highlights the
  first (or currently-selected) option"), but the calendar's equivalent open-via-click
  starting state (does it highlight `value`'s date if set, else today, in whichever
  month contains it?) isn't spelled out anywhere in §3.5 or §5's calendar test list. This
  predates round 2 (it's not part of what changed) and is a minor, easily-inferred default
  (`value || today`) rather than an architecture question — flagging for the implementer/
  `reviewer-code` to confirm the obvious default gets picked deliberately, not required to
  gate this round's approval.

### `name`-prop comment fix (non-blocking item from round 1)

Confirmed §3.1's `name` prop now carries an inline doc comment stating explicitly that
it's "currently a pure no-op" and why (this codebase's forms submit via controlled
`onSubmit`/React state, never native `FormData`) rather than leaving that only in plan
prose. Matches what round 1 asked for.

### Verdict

The round-1 blocking finding is genuinely fixed, not just asserted: the model is stated
once, unambiguously, with concrete mechanics (id scheme, `tabIndex`, where
`aria-activedescendant` is set and cleared), and every other passage in the plan that
touches focus/ARIA agrees with it. Comfortable with an engineer starting to build this
now.

VERDICT: APPROVED
