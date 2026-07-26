## reviewer-tests — round 1

### Method
Read `ticket.md` (issue #15 via `gh issue view 15`), `plan.md` (round-1-approved,
including its §4 edge-case list), and `.claude/AGENT_RULES.md`. Reviewed the full diff
for `d56f47a` against `main`. Ran `npx vitest run` (91/91 passing) and `npx tsc -b`
(clean) locally. For the three specifically-flagged items, verified the underlying
jsdom/browser mechanics empirically with standalone probe scripts run via `node -e`
(raw `jsdom` package, no React) and a throwaway Vitest project set up entirely outside
the repo in the scratch directory (symlinked `node_modules`, not touching any tracked
file) — chosen specifically so no tracked file in `apps/web` was ever edited, per this
review's read-only constraint. `git status` confirmed clean before and after.

### 1. `checkbox.test.tsx` disabled-click test (`checkbox.click()` instead of `fireEvent.click()`) — confirmed sound
Reproduced independently: dispatching a synthetic `click` `MouseEvent` via
`dispatchEvent` (what `fireEvent.click` does under the hood) on a `disabled` checkbox
in jsdom flips `.checked` to `true` (bypasses the native disabled short-circuit),
while calling the native `.click()` IDL method correctly leaves it `false`. So the
switch away from `fireEvent.click` here was necessary, not cosmetic — with the old
`fireEvent.click` this test would have been either a false failure (asserting
`checked === false` after a click that jsdom's `fireEvent` actually flips to `true`)
or, if "fixed" the wrong way, a false-passing test that no longer proves anything.
With `.click()`, the test is a real regression check: `disabled` is destructured out
of `CheckboxProps` separately from `...props` and re-applied explicitly
(`<input disabled={disabled} ... {...props} />`) specifically so it can also drive the
wrapper's dimming classes — that's a real place a careless refactor could drop
`disabled` from the actual `<input>` DOM node, and both the test's own
`expect(checkbox).toBeDisabled()` and the subsequent `checkbox.click()` /
`expect(checkbox.checked).toBe(false)` would fail if that happened. **Verdict: meaningful, non-blocking.**

### 2. `select.test.tsx` placeholder-option test (`container.querySelector('option[value=""]')` instead of `getByRole`) — confirmed sound, one minor gap
Confirmed the reason for the switch: the placeholder `<option>` has the `hidden`
attribute, and `hidden` elements are excluded from the accessibility tree that
`getByRole`/`getByText`-style queries walk by default in Testing Library — so
`getByRole("option", { name: placeholder })` returns nothing even though the element
is present and selected. The `querySelector` fallback is the only way to reach it, and
the resulting assertions (`toBeDisabled()`, `.textContent`, and `select.value === ""`)
still meaningfully cover the plan's §4 requirement ("placeholder option is present,
disabled, and ... is the initially-selected/displayed option"). **Non-blocking minor
gap**: no test anywhere asserts the placeholder `<option>` still carries the `hidden`
attribute itself — a future edit that silently dropped `hidden` (which the component's
own comment says is what keeps the placeholder out of the reopened dropdown list)
would not be caught by this suite. Plan §4 didn't explicitly call for this either, and
it's cosmetic/low-risk, so non-blocking.

### 3. `select.tsx`'s `defaultValue`/`value` fallback (the unplanned bug fix) — real fix, confirmed, but **the fix's own "back off" branch is untested (blocking)**
Independently reproduced, with raw `jsdom` (no React involved, to rule out any
React-specific quirk skewing the result): a `<select>` whose first `<option>` is
`disabled` (with no `value`/`defaultValue` set on the `<select>` and no `<option
selected>`) does **not** default to that first option per jsdom's/the browser's native
"pick a default option" algorithm — it skips disabled options and lands on the next
enabled one instead (`value` came back `"a"`, not `""`, in a 3-option repro). This
directly contradicts `plan.md` §3.5's stated assumption ("the first option in DOM
order is the initially-selected/displayed one, **even if disabled**") — that assumption
was wrong, and the fallback `defaultValue=""` the implementer added during
implementation is a genuine, necessary bug fix, not a defensive no-op.

Both `select.test.tsx`'s "shows a disabled placeholder option that is selected by
default..." test (`expect(select.value).toBe("")`) and
`ui-demo-page.test.tsx`'s Select assertion
(`expect((screen.getByLabelText("Choose a tag") as HTMLSelectElement).value).toBe("")`)
exercise the "no consumer value/defaultValue" path and would both fail if the fallback
were reverted/removed — confirmed by the mechanism above (value would resolve to the
first real option's value instead of `""`). That half of the fix is solidly covered,
twice over.

**What's missing, and why it's blocking:** the fallback is implemented as a ternary —
`placeholder !== undefined && props.value === undefined && props.defaultValue ===
undefined ? "" : undefined` — whose entire second half exists specifically so a
consumer's own `value`/`defaultValue` isn't clobbered when they supply one alongside
`placeholder` ("consumer-supplied value/defaultValue (spread below) still wins if
present", per the component's own comment). **No test anywhere — not in
`select.test.tsx`, not in the demo route — combines `placeholder` with an explicit
consumer `value` or `defaultValue`.** `reviewer-code`'s notes mention this combination
was checked manually/visually via a real browser during review, but that's not a
regression-proof automated test: a future edit that simplified the ternary (e.g. always
forcing `defaultValue=""` whenever `placeholder` is set, dropping the
`props.value`/`props.defaultValue` guards) would silently break any consumer combining
a placeholder with a pre-filled value — a realistic scenario the very next feature
ticket is likely to hit (e.g. an "edit task" form reusing the same `Select` with a
placeholder for the "no category" state but a `defaultValue` for existing tasks that
already have one). This is exactly the kind of case this review round is meant to
catch: real, risky, currently zero coverage. Recommend adding at least one test asserting
`<Select placeholder="Choose…" defaultValue="b">...</Select>` (or the `value=` /
controlled equivalent) still resolves to `"b"`, not `""`.

### 4. Minor/non-blocking: `TextInput`/`Textarea`'s "prevents updates... when disabled" tests partially test something else
Verified with a standalone React+jsdom probe: a controlled `<input value="fixed"
onChange={() => {}}>` reverts its DOM `.value` back to `"fixed"` after
`fireEvent.change(input, { target: { value: "changed" } })` **even when `disabled` is
never set at all** — this is React's controlled-input "snap back to the prop value"
behavior, not something specific to `disabled`. So the `fireEvent.change` +
`expect(input.value).toBe("fixed")` half of these tests would pass identically even if
`disabled` were completely dropped from the component. The tests aren't wrong, but the
disabled-specific proof is really carried entirely by the co-located
`expect(input).toBeDisabled()` assertion, not by the value-doesn't-change check.
Low risk in practice — unlike `Checkbox`, `TextInput`/`Textarea` never destructure
`disabled` out separately; it flows through the same `...props` spread as every other
native attribute, so there's no distinct code path left to regress independently.
Flagged for precision, not requiring a fix.

### 5. Minor/non-blocking: `Button`'s icon variant has no assertion on its own size classes
No test in `button.test.tsx` checks that the icon variant actually renders
`iconSizeClasses` (`p-1.5`/`p-2`, square) rather than falling back to the regular
`sizeClasses` (`px-3 py-1.5`/`px-4 py-2`, asymmetric) used by primary/secondary — only
accessible-name/`onClick`/`disabled` are asserted, which are variant-shape-agnostic. A
regression that accidentally used `sizeClasses[size]` for `variant === "icon"` too
(defeating the entire "square, no visible text" point of the variant) would go
uncaught. `plan.md` §4 didn't explicitly ask for a class-string assertion here either
(contrast `TextInput`, where the round-1 refiner fix made this exact kind of assertion
load-bearing) — so this reads as a pre-existing plan gap more than an implementation
gap, and it's a purely cosmetic/low-risk regression. Non-blocking.

### 6. Minor/non-blocking: `Checkbox` disabled-dimming test checks presence only, not absence
`expect(wrapper?.className).toContain("opacity-50")` /
`.toContain("cursor-not-allowed")` are only asserted in the `disabled` case; nothing
in the suite asserts these classes are **absent** on a non-disabled `Checkbox`. A bug
that applied the dimmed styling unconditionally wouldn't be caught by any test (though
it would be immediately obvious in the demo route, which `reviewer-code` already
screenshotted and reviewed visually). Non-blocking.

### Summary
Items 1 and 2 (the two test-adaptation questions this round was asked to scrutinize)
are both sound, deliberate, and verified — not accidental jsdom-quirk-testing. Item 3
(the unplanned `defaultValue` bug fix) is a real, necessary fix, well-covered for the
case it was built to fix, but its equally-important "don't override the consumer's own
value/defaultValue" branch has zero automated coverage — that's the one blocking
finding from this round. Items 4–6 are minor, non-blocking precision/coverage notes.

VERDICT: BLOCKING FINDINGS

## reviewer-tests — round 2

### Method
Reviewed fixer commit `a9223c4` on top of `d56f47a` (branch `feat/form-primitives`,
PR #25). Confirmed via `git diff d56f47a a9223c4 -- apps/web/src/components/ui/select.tsx`
(empty) and `git diff main...feat/form-primitives --stat` that **no production code
changed** — only `select.test.tsx` grew by two tests, exactly as the fixer's commit
message claims. Ran the full suite (`npx vitest run`, 93/93 passing — 91 from round 1 +
2 new) and `npx tsc -b` (clean). Then independently re-verified the fixer's own
"sanity-checked the tests' teeth" claim by making my own temporary, reverted-after
mutations to a local copy of `select.tsx` (never left uncommitted — `git status` clean
before and after each experiment; `git diff` shown empty before proceeding).

### 1. `select.tsx` unchanged — confirmed
`git diff d56f47a a9223c4 -- apps/web/src/components/ui/select.tsx` is empty. The only
diff in `a9223c4` is the 24 added lines in `select.test.tsx`. Matches the fixer's report
exactly.

### 2. New "uncontrolled `defaultValue`" test — confirmed real and load-bearing
Reproduced the fixer's claimed regression myself: reordering the JSX so `{...props}`
spreads *before* the component's own `defaultValue={defaultValue}` (i.e.
`<select className={classes} {...props} defaultValue={defaultValue}>` instead of the
original order) makes the component's computed `defaultValue` win over any
consumer-supplied `defaultValue` unconditionally. Under that mutation, the new
"keeps a consumer-supplied defaultValue..." test fails exactly as expected
(`expected 'a' to be 'b'` — the DOM lands on the first enabled option instead of the
consumer's `"b"`), while the rest of the suite (8/9) still passes. Reverted the mutation
(`git diff` empty again afterward). This closes round 1's blocking gap for the
`defaultValue` half of the fallback. **Sound, meaningful, closes the finding.**

### 3. New "controlled `value`" test — real assertion, but non-blocking caveat: it does not actually detect the regression shape round 1 hypothesized
This is worth documenting precisely, because my own empirical result differs from what
round 1's finding predicted for this branch.

I tried to reproduce a regression that would make the new "keeps a consumer-supplied
controlled value..." test fail, using both mutations round 1's finding explicitly
named as the feared future edit:
- Dropping only the `props.value === undefined` guard from the ternary (so it reads
  `placeholder !== undefined && props.defaultValue === undefined ? "" : undefined`,
  ignoring whether a controlled `value` was given) — **all 9 tests still passed**,
  including this one.
- The spread-reordering mutation from item 2 above (which *does* break the
  `defaultValue` test) — **this test still passed too** (8/9 passed, only the
  `defaultValue` test failed).

The reason: `select.tsx` never sets an explicit `value` attribute of its own — only
`defaultValue`. React's controlled-component semantics mean an explicitly-passed
`value` prop always wins over any `defaultValue` in the merged props object,
regardless of prop-spread order or the ternary's guard logic, because React ignores
`defaultValue` on a component it's already treating as controlled via `value`. So
there is no live code path in the current `select.tsx` where dropping the
`props.value` guard — or reordering the spread — can actually make the rendered
`<select>`'s value diverge from the consumer's `value` prop. Round 1's finding treated
the `value` and `defaultValue` guards as symmetric risks; empirically they aren't: the
`defaultValue` guard protects an active override the component performs, while the
`value` guard is already fully backed by React itself with or without it.

This does **not** make the test wrong or worthless — it asserts genuinely correct,
real DOM behavior (`select.value === "b"`, not a mocked call), and it would catch a
*different*, still-plausible future regression (e.g. a refactor that starts also
setting an explicit `value={...}` attribute analogous to today's `defaultValue`
override, without preserving the guard). But per this round's specific charge —
"would that test actually fail if the ... bug reintroduced" for the exact regression
shape round 1 described — it wouldn't, for either mutation I tried. The fixer's own
commit message is consistent with this: it only claims to have verified the
*defaultValue* test's teeth via mutation, not the value test's. **Non-blocking**: the
higher-risk half (`defaultValue`, the one with an active, breakable override in
today's code) is now solidly covered; the `value` half was already structurally safe
before this fix and remains so, so the absence of a mutation-proven regression test for
it isn't a real gap in present-day protection — just a note that this particular test's
"teeth" are narrower than its name suggests.

### 4. Nothing else regressed
Full suite: 93/93 passing (91 + 2 new). `npx tsc -b`: clean. `git diff --stat
main...feat/form-primitives` shows only the expected files from round 1 plus the two
new lines' worth of test additions in `select.test.tsx` (126 lines total, up from 102
at round 1) — no unrelated changes.

### Round 1 non-blocking items (4–6)
Left as-is per the fixer's report and the orchestrator's decision; re-reviewed and still
agree these are minor/cosmetic, not worth re-blocking on:
- TextInput/Textarea disabled tests partially exercising React's own controlled-value
  snap-back rather than a disabled-specific code path — still true, still low-risk since
  neither component destructures `disabled` separately from `...props`.
- Button icon variant's own size classes (`iconSizeClasses` vs `sizeClasses`) still
  unasserted — still a plan-gap more than an implementation gap, cosmetic.
- Checkbox dimming test still asserts presence-when-disabled but not
  absence-when-enabled — still low-risk, visually obvious in the demo route.

### Summary
Round 1's one blocking finding — the untested `defaultValue`-preserving branch of
`select.tsx`'s placeholder fallback — is resolved: production code is unchanged, and
the new `select.test.tsx` "defaultValue" test is proven (by two independent mutation
attempts, matching the fixer's own reported method) to actually fail if that branch
regresses. The companion "controlled value" test is real and correct but, on inspection,
turns out to be un-breakable by any of the regression shapes round 1 or I tried, because
React's controlled/uncontrolled semantics already fully protect that path independent of
the guard — flagged as a non-blocking precision note, not a gap in actual protection.
No other regressions found; full suite and typecheck are clean.

VERDICT: APPROVED
