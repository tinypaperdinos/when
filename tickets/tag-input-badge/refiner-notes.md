# Refiner notes: tag-input-badge

## Round 1

Reviewed against `tickets/tag-input-badge/ticket.md` (→ GitHub issue #17, confirmed
verbatim via `gh issue view 17`) and the actual state of `apps/web/src/components/ui/`
on current `main` (branch `feat/tag-input-badge` cut from up-to-date main, verified via
`git log main` / `git branch -a`).

### Verified as accurate (not re-litigated below)

- `text-input.tsx` genuinely does not use `forwardRef` today (plain function component,
  confirmed by reading the file) — the plan's factual claim here is correct.
- No `components/ui/*.tsx` file imports `trpc`/`useQuery` today (grepped) — the plan's
  reading of `AGENT_RULES.md`'s "goes through a tRPC procedure" rule as scoped to
  page-level code, not `components/ui/` primitives, matches actual codebase practice, not
  just a convenient rationalization.
- `fireEvent`-only test convention (no `user-event`) confirmed across existing
  `components/ui/*.test.tsx`.
- `Tag { id, name @unique }` / `Entry.tags: Tag[]` schema, `DateTimePicker`'s
  controlled-only precedent and README bullet, and the `explore/page-design` tag-chip
  mockup markup all check out as the plan describes them.
- Issue #17's full text matches the plan's quote exactly — no scope drift from
  paraphrasing.

### Finding 1 (substantive — the main reason for REVISE): the stated justification for
touching `text-input.tsx` (`forwardRef`) does not hold up

§3.2 and §6.3 justify adding `forwardRef` to the already-merged `text-input.tsx` as
needed "to refocus the text field after a suggestion is chosen by click," reasoning that
"a mouse click on a suggestion would otherwise move focus to the clicked button."

That's not how the mechanism the plan itself describes actually works. The plan already
relies on `onMouseDown={(e) => e.preventDefault()}` on each suggestion `<button>`, and
correctly explains *that* call as load-bearing to stop the mousedown-triggered blur from
closing (unmounting) the dropdown before the click can land. But `preventDefault()` on
`mousedown` doesn't just suppress the resulting `blur` event as a side effect — per the
standard DOM focus-management behavior (confirmed via search: the browser's default
focus-shift on mousedown is exactly what `preventDefault()` cancels), it prevents focus
from moving to the clicked button in the first place. If the input never blurs, it never
loses focus, and `inputRef.current?.focus()` after `commitTag()` is a no-op in every
mainstream browser — the ref-based refocus this plan cites as the reason to touch
`text-input.tsx` is very likely dead code, not a load-bearing behavior.

This matters because:
- The plan's own §6.3 already flags this as "a change to a file this ticket doesn't
  otherwise own" and offers a one-line fallback (a raw `<input>` inside `tag-input.tsx`)
  specifically for the case where the justification doesn't hold. That case appears to be
  exactly what's happening here.
- The test the plan proposes to cover this ("clicking a rendered suggestion... moves
  focus back to the text input afterward... proving the `onMouseDown` `preventDefault`
  actually prevents the blur-before-click race") would pass identically whether or not
  the explicit `.focus()` call (and therefore the `forwardRef` plumbing) exists, because
  focus never left the input to begin with. The test as designed can't actually
  distinguish "the ref-refocus is necessary" from "the ref-refocus is a no-op" — it
  isn't the verification the plan implies it is.
- Given `AGENT_RULES.md`'s explicit "don't introduce a new pattern for no reason" spirit
  and the plan's own bar of "worth confirming isn't scope creep," this should be
  resolved before implementation starts, not left as a live open question for
  `reviewer-code` to catch post-hoc: either (a) drop the `.focus()` call and the
  `forwardRef` change entirely and confirm in a scratch spike that focus still lands
  correctly (cheap, ten minutes, definitively resolves it), or (b) keep `forwardRef` only
  if that spike shows it's actually needed in a case the plan hasn't described (e.g. some
  browser/JSDOM discrepancy), and update §3.2/§6.3's reasoning to reflect the real reason
  rather than the currently-stated one, which appears to be incorrect the mechanism it
  describes contradicts its own preventDefault reasoning one paragraph earlier.
- Note jsdom's `fireEvent.mouseDown` + `preventDefault` behavior around focus may not
  perfectly mirror real-browser behavior either way — worth confirming the test actually
  exercises the real mechanism (not just "activeElement is input because it was never
  blurred by jsdom's fireEvent in the first place, independent of preventDefault").

This is the one item from the plan's own §6 worth pushing back on hard: not because
cross-cutting touches are forbidden, but because the specific technical reasoning given
for this one is inconsistent with the mousedown/preventDefault mechanism the plan relies
on one paragraph earlier for a different (correctly-reasoned) purpose.

### Finding 2 (minor, non-blocking): `role="option"` wrapping a real `<button>`

The listbox items are `<li role="option"><button type="button">...</button></li>`. In
the `aria-activedescendant` combobox pattern (which this plan otherwise follows
correctly — focus stays on the `role="combobox"` input, `aria-activedescendant` points at
the virtually-highlighted option), the options are conventionally non-focusable — the
"virtual focus" model is exactly what makes `aria-activedescendant` meaningful. Making
each option a real, independently-tabbable `<button>` means a keyboard user pressing Tab
while the dropdown is open moves real DOM focus into the listbox (or, in this
implementation, straight past it if `onBlur` on the input closes/unmounts the dropdown
before Tab's focus-move completes — behavior that isn't specified either way). This is a
genuine rough edge, but the plan already explicitly defers "more complete ARIA 1.2
keyboard coverage" as a future/richer-combobox-library concern (§2.5), so I'm not
treating this as blocking — flagging it so it's a documented, deliberate deferral rather
than an unnoticed gap. Worth one sentence in §5's non-goals or a code comment, not a
redesign.

### Finding 3 (minor, non-blocking): inconsistent speculative-addition standard between
`Badge`'s color variants and the size-variant non-goal

§6.2 justifies adding `accent`/`neutral` `Badge` variants (beyond the single `pop` style
actually needed anywhere today) as "consistency with `Button`/`Card`'s established
variant-map pattern," while §5 declines a `size` variant on the same component with
almost the identical justification pattern in reverse ("neither requested... matching how
several other single-size primitives... also started without one"). Both calls are
individually defensible and low-risk, but the plan applies opposite defaults (add
speculative color variants; don't add a speculative size variant) without reconciling why
color gets the more permissive treatment. Not blocking — just note it so `reviewer-code`
isn't left wondering whether this was a deliberate distinction or an inconsistency.

### Scope fidelity, freeform-creation reading, and `suggestions` prop: hold up

These are the three items the plan's own §6 flags as most contestable (freeform tag
creation, `Badge` variant set, `suggestions` as a plain prop vs. a live query) — checked
each against the issue text, the schema, and existing codebase conventions, and in each
case the plan's chosen reading is a defensible one with real supporting evidence (schema
has no "pre-approved tag" concept; no `ui/` component does data-fetching; `Select`'s own
demo already treats tag-like values as plain strings, not `{id, name}` objects), not an
arbitrary pick dressed up as reasoned. No objection to those three beyond what the plan
already says about them.

### Verdict rationale

Finding 1 is a real, checkable technical claim that turns out to be very likely wrong,
and it's the one directly underpinning a cross-cutting touch to a file this ticket
doesn't otherwise own (`text-input.tsx`). Given the plan itself treats "is this touch
justified" as an open question, and the stated justification doesn't survive scrutiny,
this should be resolved (spike-and-confirm, or fix the reasoning, or take the one-line
fallback already on offer) before an engineer starts building — not deferred to
`reviewer-code` to notice after the fact. Findings 2 and 3 are non-blocking and can ship
as-is or be tightened in the same pass.

VERDICT: REVISE

## Round 2

Reviewed the round-2 diff to `plan.md` (all `[round 2]` markers) against round 1's
blocking finding and its two non-blocking notes, plus a re-scan of the rest of the plan
for anything the edit might have disturbed. Verified against the actual repo state
(`feat/tag-input-badge`, cut from up-to-date `main`; no code changes yet, planning stage
only) and by running two small scratch Vitest specs (deleted afterward, confirmed via
`git status --short` that no scratch file was left behind) to check the DOM-focus claim
empirically rather than take it on the plan's say-so a second time.

### Round 1's blocking finding: correctly resolved

- `apps/web/src/components/ui/text-input.tsx` on `main` is confirmed still a plain
  function component (`export function TextInput({ size = "md", className, ...props })`),
  no `forwardRef`, matching the plan's "fully untouched" claim in §1/§3.7/§5.
- The `useRef`/`.focus()` call is gone from §3.2's rendering notes and commit-logic
  description; the plan now correctly derives, from its own already-adopted
  `onMouseDown={(e) => e.preventDefault()}` handler, that focus never leaves the input
  during a suggestion click, so no refocus call is needed. This is the correct resolution
  path round 1 offered as option (a).
- §6 item 3 keeps the round-1 finding as resolved history rather than deleting it —
  matches this repo's pattern of keeping prior rounds' reasoning visible (same spirit as
  `refiner-notes.md` itself never being overwritten).
- Files-touched summary (§3.7) and non-goals (§5) both explicitly list
  `text-input.tsx` as untouched with a pointer to why — consistent everywhere I checked,
  no stale reference to `forwardRef` left anywhere else in the document (grepped the full
  plan text for "forwardRef"/"inputRef" — only appears in the explanatory round-2/history
  notes, never in an active task description).

### Round 1's two non-blocking notes: addressed as described

- ARIA `role="option"`-wrapping-a-`<button>` deviation is now called out explicitly in
  §3.2, §5, and §6 item 4 as a documented, deliberate trade-off rather than a silent gap.
  Accurate framing, nothing further needed.
- The `Badge` color-variant vs. `size`-variant asymmetry is reconciled in §3.1's new
  bullet: color variants reuse three tokens `index.css` already defines and
  `README.md` already documents (`pop`/`accent`/paper-ink pairing — confirmed by reading
  `index.css` lines 15-20), while a `size` variant would mean inventing new padding/
  text-size tokens nobody has asked for. I independently confirmed `index.css` defines
  exactly one padding/text-size scale for chip-scale UI (no existing small/large tag-chip
  precedent) — the reconciliation's factual premise holds.

### New finding (non-blocking, but worth flagging clearly): the round-2 replacement test's
stated rationale doesn't hold up either, for a similar-shaped reason as round 1's finding

§3.2 and §4 now justify the `onMouseDown={preventDefault}` handler with a new test:
"assert `document.activeElement` is (still) the text input immediately after the click...
this is the actual, meaningful check that `onMouseDown`'s `preventDefault()` is doing its
job." I checked this empirically rather than trust it a second time, since round 1's
whole finding was exactly "a test in this plan claims to verify a mechanism it can't
actually distinguish."

Two scratch Vitest specs against this repo's actual `fireEvent`-only convention (no
`user-event`) show:

- `fireEvent.mouseDown(button)` in jsdom does **not** shift `document.activeElement` to
  the button, with or without `preventDefault()` called in the handler — activeElement
  stays on the previously-focused input in both cases.
- More importantly, `fireEvent.mouseDown(button)` also does **not** trigger a `blur`
  event on the previously-focused input, with or without `preventDefault()`.

In other words: this repo's established test tooling (`fireEvent`, not `user-event`)
never reproduces the actual browser default-action chain (mousedown → focus-shift →
blur-of-previous-element) that `onMouseDown={preventDefault}` exists to interrupt. That
means:

1. The plan's new assertion ("activeElement is still the input after the click") will
   pass identically whether or not the `onMouseDown={(e) => e.preventDefault()}` handler
   is present at all — it isn't proof of the mechanism the prose claims it proves, for
   the same underlying reason round 1's version of this test wasn't (jsdom's `fireEvent`
   doesn't simulate the browser behavior being tested).
2. More significant than the wording: none of the plan's other proposed
   click-a-suggestion tests would fail either if the `onMouseDown` handler were dropped
   from the implementation entirely — because the `onBlur`-closes-the-dropdown race it
   guards against can't be triggered by `fireEvent.mouseDown` in the first place in this
   test environment. So this plan, as written, has no test that would catch a regression
   removing the (real, still-necessary-in-actual-browsers) `preventDefault()` call.

This is genuinely the same category of issue round 1 caught — a test whose stated
justification doesn't survive checking the actual mechanism — just now confined to the
*replacement* test rather than dead production code. I'm treating it as **non-blocking**
rather than sending this to a third round, for reasons that don't apply symmetrically to
round 1's finding:

- It doesn't affect production code, scope, architecture, or the data model at all — the
  `onMouseDown={preventDefault}` handler itself is correct, standard, well-documented
  combobox practice and should be kept regardless of whether jsdom can exercise it.
- Unlike round 1 (where the stated justification was the reason a shared, already-merged
  file was being modified), nothing here proposes touching a file this ticket doesn't own
  — it's purely a test-coverage/rationale-accuracy gap for one interaction.
- It's fixable in the implementation/review phase without revising the plan's design: the
  implementer or `reviewer-tests` can either (a) reword the test's purpose comment to not
  overclaim ("regression guard for the DOM structure, not proof the preventDefault
  mechanism works — this repo's `fireEvent` convention can't exercise real mousedown
  default-actions") and accept the coverage gap as a known limitation of the
  `fireEvent`-only convention, or (b) add one narrowly-scoped `user-event` test as an
  explicit, called-out exception to the `fireEvent`-only convention specifically because
  `user-event` (unlike raw `fireEvent`) does simulate the browser's default mousedown
  focus-shift/blur behavior, if actual regression coverage for this mechanism is wanted.
  Either resolution is small and contained — worth a note to the implementer, not a
  reason to block starting the build.
- Practically, if this handler were ever accidentally removed by a future edit, the
  consequence is a minor, easily-noticed-in-manual-QA UX bug (clicking a suggestion
  briefly closes the dropdown before the click registers), not silent data corruption or
  a scope violation.

Flagging this explicitly so `reviewer-tests` doesn't take the plan's "this is the
meaningful check" claim at face value, and so the implementer's PR description or a code
comment on the `onMouseDown` handler notes the coverage gap rather than leaving future
readers to assume the existing test proves more than it does.

### Re-scan for anything else the edit disturbed

- Skimmed the full plan again end-to-end (not just the `[round 2]`-marked deltas) for any
  other place that might still reference the removed `ref`/`forwardRef` approach or that
  the edit might have left inconsistent. Found none — §2, §3.3–§3.7, §4 (aside from the
  finding above), §5, and §6 items 5–8 are unchanged from round 1 and still hold up on
  re-read (schema, `suggestions` prop, freeform-creation reasoning, `MAX_SUGGESTIONS`,
  keyboard clamping, layout choice — all previously verified in round 1 and not touched
  by this revision).
- Confirmed `components/ui/README.md`'s current text on `main` still matches what §3.6
  describes it will extend (the `explore/page-design` pointer bullet and the "composite,
  controlled-only components" bullet both exist today, verified by reading the file), so
  §3.6's planned edits still land on the text the plan assumes is there.

### Verdict rationale

Round 1's one blocking finding is genuinely resolved, not just reworded — the dead code
and the unjustified cross-cutting file touch are both gone, and the replacement reasoning
in §3.2/§6 item 3 is internally consistent with the `preventDefault` mechanics it
describes. The two non-blocking notes are addressed with real reconciling arguments, not
hand-waved. The one new issue I found (the replacement test's overclaimed rationale, and
the resulting real gap in regression coverage for the `onMouseDown` handler) is
real and worth a clear note, but it's contained, low-risk, doesn't touch scope or shared
state, and is fixable during implementation/review without another planning round —
it doesn't meet the bar of "an engineer shouldn't start building this."

VERDICT: APPROVED
