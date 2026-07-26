## reviewer-code — round 1

### Method
Read `ticket.md` (issue #15 via `gh issue view 15`), `plan.md` (round-1-approved), and
`.claude/AGENT_RULES.md`. Reviewed the full diff for `d56f47a` against `main`. Ran, and
confirmed green: `npm run lint`, `npm run typecheck`, `npm run test -- --run` (91/91
passing), `npm run build`. Also started the Vite dev server and drove the real
`/dev/ui` demo route with a headless Chromium (Playwright, installed for this review)
to check runtime/visual behavior beyond what jsdom unit tests exercise: screenshotted
the full page, clicked the unchecked/disabled Checkbox demo examples, and drove the
placeholder Select via `selectOption`.

### Verification of the three implementer-flagged pragmatic fixes
All three called out in the task prompt were independently reproduced and confirmed
sound, not just convenient:

1. **`checkbox.test.tsx` disabled-click using `.click()` instead of `fireEvent.click()`**:
   confirmed empirically — a scratch test firing `fireEvent.click()` on a
   `disabled` checkbox in jsdom actually flips `.checked` to `true` (jsdom's
   `fireEvent` bypasses the native disabled-activation check), while `.click()`
   correctly leaves it `false`. Using `fireEvent.click()` here would have been a false
   negative waiting to happen (or actively wrong if it had been asserted the other way).
   Also confirmed live in a real browser (Playwright) that a real click on the disabled
   demo checkbox is genuinely blocked (timeout on `locator.click()`), so the underlying
   component behavior is correct — the test tool discrepancy is a jsdom-only quirk,
   correctly routed around.
2. **`select.test.tsx` placeholder query via `container.querySelector` instead of
   `getByRole`**: confirmed empirically — `screen.queryByRole("option", { name: ... })`
   for a `hidden` `<option>` returns `null` even when the option is present and
   selected, matching the stated spec reasoning (hidden elements are excluded from the
   accessibility tree, so there's no computable accessible name/role to query by). The
   `querySelector` fallback is the only viable way to assert on that element's fixed
   `value=""`.
3. **`select.tsx`'s explicit `defaultValue=""` fallback**: confirmed empirically that the
   plan's original assumption was wrong — a `<select>` with a `disabled hidden` first
   `<option value="">` and no `value`/`defaultValue` set on the `<select>` itself
   actually resolves to the first *non-disabled* option's value (`"a"` in a 3-option
   scratch case), not the placeholder. The implemented fix (compute `defaultValue=""`
   when the consumer supplies neither `value` nor `defaultValue` and a `placeholder` is
   given, letting consumer-supplied `value`/`defaultValue` win via prop-spread order)
   is correct and was verified via the demo page: `Select aria-label="Choose a tag"
   placeholder="Choose a tag…"` (no consumer value) correctly initializes to `""`, and
   `selectOption('personal')` correctly updates it afterward. Also correctly avoids the
   React dev warning about setting `selected` directly on an `<option>`, as noted in the
   commit message.

### Scope fidelity vs. ticket.md / plan.md
- Issue #15 asks for: Button (primary/secondary/icon), text input, textarea, checkbox,
  select/dropdown, all generic/reusable/tested under `components/ui/`. All five are
  present, each with a colocated test file, each registered in `ui-demo-page.tsx` (and
  `ui-demo-page.test.tsx` extended accordingly). `Button`'s `icon` variant is added in
  place per §3.1, not rebuilt — confirmed `primary`/`secondary` code paths are untouched
  aside from the new `variantClasses.icon`/`iconSizeClasses` additions.
- No unrequested feature wiring found (no `TasksPage`/Notes/task-completion-toggle
  changes) — matches the plan's non-goals.
- `field-base.ts`, `--shadow-input`, and the README updates all match plan §2.3/§2.5/§3.7
  essentially verbatim.
- `Select`'s `placeholder` prop (plan's own flagged open question #2, "not requested by
  the issue") is present. I don't consider this blocking scope creep — it's a single
  small, well-isolated, well-tested prop the plan already flagged and reasoned about, and
  the plan was fully approved with this included.
- One deviation from plan §3.3 worth noting as non-blocking: the plan's snippet showed
  `export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}`
  (interface), and the implementation uses `export type TextareaProps =
  TextareaHTMLAttributes<HTMLTextAreaElement>;` (type alias). Functionally identical,
  avoids an empty-interface lint smell, doesn't affect any consumer — non-blocking.

### Correctness
- Cross-checked every edge case listed in plan.md §4 against the five `*.test.tsx`
  files — all are present and, per the test run, all pass. No gaps found.
- `TextInput`/`Textarea`/`Select`'s class composition genuinely has no same-specificity
  overlapping utility pairs on one element (the exact bug class the plan's round-1 fix
  was designed to prevent) — confirmed by reading `field-base.ts` (no padding/text-size)
  against each consumer's own padding/text-size string.
- `Checkbox`'s `peer`-sibling structure (input, box span, checkmark svg as flat siblings)
  is implemented exactly as specified in plan §3.4, and works correctly when driven
  through a real browser (checked state toggles the box background and reveals the
  checkmark — confirmed visually in the screenshot).
- Verified (real Chromium, not just code-reading) that `stroke="var(--color-ink)"` /
  `stroke="var(--color-paper)"` as raw SVG presentation attributes (used in `select.tsx`'s
  chevron and `checkbox.tsx`'s checkmark) do resolve the CSS custom properties correctly
  at render time (`getComputedStyle` returned the correct resolved RGB values) — this
  pattern has no prior precedent elsewhere in the codebase and some sources suggest
  presentation attributes don't participate in var()-substitution the same way `style=`
  does, so I checked it empirically rather than taking the pattern on faith. No issue.
- The Select's `defaultValue`/`{...props}` prop-spread ordering (explicit `defaultValue`
  attribute followed by `{...props}`) correctly lets a consumer-supplied
  `value`/`defaultValue` win when present, since the local computed fallback is
  `undefined` in that case — checked the four relevant combinations (no
  value/defaultValue + placeholder, no value/defaultValue + no placeholder,
  consumer-supplied `defaultValue`, consumer-supplied controlled `value`) and all behave
  as intended.

### Pre-existing issue observed, out of scope for this diff (informational only)
While screenshotting `/dev/ui` I saw a React console warning: `<div>` (rendered by `Card`)
nested inside a `<p>` in the demo page's "Card" section — invalid HTML nesting,
technically a hydration-error risk. Confirmed via `git blame` this line predates this
diff (from `layout-primitives`, commit `2297a0f3`), and this diff didn't touch that
section. Flagging only for visibility, not as a finding against this PR.

### Design / simplification
No unnecessary abstraction found. `field-base.ts`'s proactive extraction (plan's own
flagged open question #4) is reasonable given three real call sites from the start and
directly informed by the `131b911` precedent; nothing here indicates it should be
inlined instead. `Checkbox` correctly does not use `field-base.ts` (its visual structure
is unrelated to a text-field well), matching plan reasoning.

### CI / build
`lint`, `typecheck`, `test` (91/91), and `build` all green locally on `d56f47a`.

VERDICT: APPROVED

## reviewer-code — round 2

### Method
Read `ticket.md` (issue #15), `plan.md`, `.claude/AGENT_RULES.md`, my own round-1 notes
(approved), and `review-notes-tests.md`'s round-1 blocking finding (select.tsx's
placeholder+consumer-value-backoff branch untested). Diffed `d56f47a` (round-1 base)
against the fixer's `a9223c4` and confirmed the production `select.tsx` is byte-identical
(`git diff d56f47a a9223c4 -- .../select.tsx` is empty) — only `select.test.tsx` changed
(+24 lines, two new tests). Ran `lint`, `typecheck`, `npx vitest run` (93/93, up from 91
since round 1 — the two new tests, no regressions), and `build` fresh on the clean,
unmodified `a9223c4` HEAD: all green.

### Verifying the fix actually closes the round-1 gap (not just trusting the commit message)
The fixer's commit message claims a manual mutation-testing sanity check ("reordering the
`defaultValue`/`{...props}` spread ... confirmed the new `defaultValue` test failed, then
restored"). I didn't take that on faith — I reproduced it independently and then went
further, since "reordering the spread" is not the same mutation reviewer-tests' round-1
note actually named as the risk ("a future edit that simplified the ternary ... dropping
the `props.value`/`props.defaultValue` guards").

1. **Reproduced the fixer's own described mutation** (swap
   `<select ... defaultValue={defaultValue} {...props}>` to
   `<select ... {...props} defaultValue={defaultValue}>`, `select.tsx` only, then
   reverted): the new "keeps a consumer-supplied **defaultValue**" test fails
   (`select.value` resolves to `"a"` instead of `"b"`) — confirmed sound, matches the
   commit message. The new "keeps a consumer-supplied **controlled value**" test still
   *passes* under this same mutation (React's controlled `value` always wins regardless
   of a coexisting stale `defaultValue`, since they're different prop keys — JSX
   attribute order only matters when the *same* key is set twice, as in the
   `defaultValue`/`defaultValue` case, not `value`/`defaultValue`).

2. **Directly tested the exact mutation reviewer-tests named** (dropped both guards:
   `const defaultValue = placeholder !== undefined ? "" : undefined;`, keeping the JSX
   order untouched, `select.tsx` only, then reverted): ran `select.test.tsx` — **all 9
   tests still pass**, including both new ones. This mutation is *not* caught by either
   new test.

   This is not actually a coverage gap, though — it's because the hypothesized
   regression doesn't change any observable behavior given the current code shape. Two
   things independently neutralize it: (a) `{...props}` is spread *after* the explicit
   `defaultValue={defaultValue}` attribute in the JSX, so a consumer-supplied
   `defaultValue` (a literal, same-named key in `props`) always overrides the local
   computed value regardless of what the ternary's guards compute — the guards are
   provably redundant for the `defaultValue` path specifically, given this spread order;
   and (b) for the controlled-`value` path, React's own `<select>` implementation gives
   `value` precedence over any coexisting `defaultValue` unconditionally, so nothing this
   component's ternary computes can ever un-win a consumer's controlled `value`. I
   verified both of these mechanically (mutation applied → identical passing behavior),
   not by assumption. So "dropping the guards" — the specific shape round 1 worried about
   — turns out to be dead code elimination, not a real regression; there's nothing there
   to catch.

   The actually-dangerous edit is the *spread-order* one (item 1), and that one **is**
   caught, at least for the `defaultValue` path.

### Finding: the new controlled-`value` test has no discriminating power (non-blocking)
`select.test.tsx`'s "keeps a consumer-supplied controlled value when placeholder is also
given (fallback backs off)" test cannot fail from any change to this component's
`defaultValue`-fallback logic — only from a change that stops forwarding `value` onto the
`<select>` at all (a much coarser break, already caught elsewhere by "updates a controlled
value via fireEvent.change"). Its docstring implies it's proving the fallback "backs off"
for the controlled case, but it's actually just re-proving React's own controlled-`<select>`
precedence, independent of anything `select.tsx` does. Not a defect — it doesn't assert
anything false — but it doesn't add the regression protection its name claims, and a
reader could mistakenly treat it as covering the controlled half of the backoff branch
when it doesn't. **Non-blocking**: the one branch that could actually regress in a way a
future refactor might introduce (the spread-order case) is covered by the sibling
`defaultValue` test, so no real gap remains here — this is a precision/naming note, in the
same spirit as reviewer-tests' own round-1 item 4 (disabled tests partially exercising an
unrelated React behavior).

### Verdict on round-1's blocking finding
The gap reviewer-tests flagged (zero automated coverage of the "consumer's own value/
defaultValue wins over the placeholder fallback" branch) is closed for the practically
reachable regression (JSX-attribute-reorder), which is now caught. The precise mutation
shape named in round 1 turns out, on close empirical inspection, not to be a real bug at
all given the current code, so its being "uncaught" isn't a live risk. No production code
changed (confirmed byte-identical `select.tsx`), so none of round 1's other approved
findings need re-verification beyond the fresh full green run above (no regressions
introduced).

### Fresh regression check
`lint`, `typecheck`, `npx vitest run` (93/93), and `build` all green on the clean `a9223c4`
working tree (verified `git status` clean before and after all mutation probes — every
temporary edit to `select.tsx` was reverted with `git checkout --`). No other files in the
round-2 diff besides `select.test.tsx`, so no other surface to regress.

VERDICT: APPROVED
