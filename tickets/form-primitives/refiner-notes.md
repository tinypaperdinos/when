# Refiner notes: form-primitives

## Round 1

Overall this is a strong, unusually well-reasoned plan: it correctly reads
`button.tsx`'s existing "extend in place" note, correctly transcribes the real
`ButtonProps`/`baseClasses`/`README.md` conventions (verified against the actual files),
and proactively surfaces the ambiguous calls (`Checkbox` scope, `Select` placeholder,
icon-button color, `field-base.ts` extraction) in its own §6 rather than silently
deciding them. That said, one finding below is a real, confirmed bug that should block
implementation, plus a couple of smaller gaps.

### 1. (Blocking) `field-base.ts` + `TextInput`'s `sm` override relies on a Tailwind
   behavior that doesn't exist — the `sm` variant will have unpredictable styling

§2.5/§3.2: `fieldBaseClasses` hardcodes the "md" padding/text-size directly into the
shared base string (`"... px-3 py-2 text-base ..."`), and `TextInput`'s `sizeClasses.sm`
= `"px-2 py-1 text-sm"` is concatenated *after* it via `cn(fieldBaseClasses,
sizeClasses[size], className)`. The plan explicitly acknowledges this is unusual and
justifies it by saying it "relies on it being the later class in the `cn()` call for
Tailwind's cascade to apply it predictably" (§3.2).

That justification is factually wrong. Tailwind CSS resolves conflicting utility
classes of equal specificity by the order the corresponding rules appear in the
**generated stylesheet**, not by the order the class names appear in the `class`
attribute/JSX string — this is a well-documented Tailwind gotcha (Tailwind's own docs:
"the only thing that matters is the order of the styles in the CSS file, not the order
in the class attribute"; see also `tailwindlabs/tailwindcss` discussion #20306). For the
`sm` size, the rendered element will simultaneously carry `px-3 py-2 text-base` (from
`fieldBaseClasses`) *and* `px-2 py-1 text-sm` (from `sizeClasses.sm`) — genuinely
conflicting same-specificity utilities present at once — and which one visually wins is
determined by Tailwind's internal generation/scan order, not by anything this plan
controls or that JSX authors can rely on. Best case it happens to render right by
accident of scan order and is a landmine for the next refactor; worst case `sm` silently
renders at `md`'s padding/text-size (or some other unintended mix) from day one, and a
class-string-assertion test (§4: "`sm` vs `md` produces the corresponding
padding/text-size classes") would still pass because it only checks that the class
*names* are present in the string, not which one actually wins in the cascade — so this
bug would ship undetected by the test plan as written.

This is also a real deviation from the codebase's own established pattern, not just a
new judgment call: `button.tsx`'s `baseClasses` contains **no** `px`/`py`/`text-*` at
all — sizing lives exclusively and non-overlapping in `sizeClasses`. Same for
`card.tsx`/`panel.tsx`'s `baseClasses` vs. `paddingClasses` (verified by reading all
three files). None of the three existing components ever put a default size value in
the shared base string and then a competing size value in a variant map for the same
element — this plan is the first to do that, and it's the exact case that breaks.

Fix (mechanical, doesn't require redesigning anything else in the plan): don't put
`px-3 py-2 text-base` inside `fieldBaseClasses` at all — keep it to genuinely
size-independent styles (`w-full`, border, background, `shadow-input`, focus-visible,
disabled). Give `TextInput` a complete `sizeClasses: Record<TextInputSize, string>` with
both `sm` and `md` fully spelled out (mirroring `Button`/`Card`/`Panel`), and have
`Textarea`/`Select` (which have no size axis) append the same `"px-3 py-2 text-base"`
themselves at their own call site instead of inheriting it silently from the base. This
also removes the plan's own "not immediately obvious why `md` repeats values already in
the base string" caveat entirely, rather than just documenting the confusion.

### 2. (Minor, non-blocking) `Select`'s `multiple` attribute isn't actually prevented

§5 lists `<select multiple>` as explicitly out of scope because the custom
chevron/`appearance-none` styling assumes single-value rendering. But `SelectProps`
extends `SelectHTMLAttributes<HTMLSelectElement>` with no `Omit`, so nothing stops a
consumer from passing `multiple` — it'll compile, pass through `...props`, and produce a
native multi-row listbox with the custom absolutely-positioned chevron rendered on top
of/inside the option list. This is the same category of problem the plan solved for
`type` (`Checkbox`) and `size` (`TextInput`) via `Omit`, just not applied here. Doesn't
need to block round 1 — either `Omit<SelectHTMLAttributes<...>, "multiple">` (forcing a
typecheck error on misuse, consistent with how the plan handles every other
attribute clash) or an explicit note that this is intentionally left as a documented,
not type-enforced, misuse case (matching the `aria-label`/icon-button precedent) would
close the gap. Flagging so it's a deliberate choice either way, not an oversight.

### 3. (Minor, non-blocking) `field-base.ts` test-coverage rationale is a little thinner
   than the closest precedent

§2.5 skips a colocated test for `field-base.ts` on the grounds that it's "a single
string constant with no branching/logic." That's true and reasonable, but note the
closest existing precedent, `src/lib/cn.ts`, *does* have a colocated `cn.test.ts` even
though it's also small — the distinguishing fact here is that `cn.ts` has actual
branching (`filter(Boolean)`) and `field-base.ts` doesn't, so the plan's reasoning holds
on inspection, but it's worth reviewer-code double-checking this doesn't read as "we
skipped a test because it was inconvenient" once `field-base.ts` picks up its first bit
of real logic in a future ticket (e.g. if it ever grows a size axis itself).

### Things checked and found solid (not re-litigating in future rounds unless something
   changes)

- `Button`'s current real state (`variant`/`size` types, `baseClasses`, extend-in-place
  note) matches what the plan describes, verified against `button.tsx`/`button.test.tsx`.
- `--shadow-hard` token and `README.md`'s documented conventions match what the plan
  cites verbatim.
- The `Checkbox` peer-sibling structure (input/box/svg as flat siblings, not nested) is
  correctly reasoned — Tailwind's `peer-*` variant only matches general siblings, and the
  proposed markup keeps all three as siblings of the same parent, so `peer-checked` on
  both the box and the svg will work as described.
- The `field-base.ts` proactive-extraction decision (§2.5, §6.4) is consistent with, not
  a violation of, the `layout-primitives` "rule of three" precedent — that precedent
  said extract when a third bordered-box component *appears*, and here the third
  (`Select`) appears within this same ticket, so extracting at ticket-start rather than
  waiting for a future PR-review comment is a defensible reading, not scope creep.
- Non-goals (§5) correctly exclude wiring into real pages, the spring-pop checkbox
  interaction, multi-select, indeterminate, form-level `Field` composition, and error/
  validation styling — none of these are requested by issue #15, and the plan's
  reasoning for each exclusion is concrete rather than hand-waved.
- No hidden risk to shared/external state — this is a presentational-only, frontend-only
  ticket (confirmed: no Prisma/server files touched), consistent with the low-risk
  profile the plan claims for itself.

VERDICT: REVISE

## Round 2

Re-verified both round-1 fixes against the plan text and against the actual current
files (`button.tsx`, `card.tsx`, `panel.tsx`, `index.css`, `README.md`, issue #15 via
`gh issue view 15`), then re-read the rest of the plan fresh rather than only diffing
the two changed sections.

### Round-1 blocking finding (CSS-specificity bug): confirmed fixed

§2.5's `fieldBaseClasses` now reads:

```
"w-full rounded-sm border-2 border-ink bg-paper " +
"shadow-input outline-none placeholder:text-ink/40 " +
"focus-visible:outline-dashed focus-visible:outline-2 " +
"focus-visible:outline-offset-2 focus-visible:outline-accent " +
"disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-line/10"
```

No `px`/`py`/`text-*` anywhere in it — confirmed by reading the string directly. Each of
the three consumers now supplies a complete, non-overlapping padding/text-size string at
its own call site:
- `TextInput` (§3.2): `sizeClasses = { sm: "px-2 py-1 text-sm", md: "px-3 py-2 text-base" }`
- `Textarea` (§3.3): fixed `"px-3 py-2 text-base min-h-24 resize-y"`
- `Select` (§3.5): fixed `"px-3 py-2 text-base appearance-none pr-8"`

Since `fieldBaseClasses` and each consumer's size string no longer target the same
utility category, there's no longer any pair of conflicting same-specificity classes
present on one element at once — the bug class round 1 flagged (which utility "wins" is
undefined by anything JSX/`cn()` ordering controls) cannot recur here. This also now
correctly mirrors the verified real pattern in `button.tsx` (`baseClasses` has no
`px`/`py`/`text-*`, `sizeClasses` has it exclusively) and `card.tsx`/`panel.tsx`
(`baseClasses` vs. `paddingClasses`, same split) — read all three files directly to
confirm the plan's characterization of the existing convention is accurate, not just
asserted. The §4 test assertion ("`sm` vs `md` produces the corresponding padding/
text-size classes") is now a meaningful proof of what renders, as claimed. Fix verified
solid.

### Round-1 minor finding (`Select` `multiple` omission): confirmed fixed

§3.5 now declares `SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>,
"multiple">`, closing the gap — passing `multiple` is now a `typecheck` error rather than
a silently-broken render, consistent with how `type` (`Checkbox`) and `size` (`TextInput`)
are already handled. §5 and §4's "not planned as a dedicated test" section were both
updated consistently to reflect the type-level enforcement rather than still describing
it as a prose-only boundary. No loose ends.

### Fresh re-check of the rest of the plan (round 2)

- Cross-checked the plan's transcription of `button.tsx`, `card.tsx`, `panel.tsx`,
  `index.css`, and `components/ui/README.md` against the actual files — all direct
  quotes/paraphrases (variant/size types, `baseClasses` contents, `--shadow-hard` value,
  documented conventions, the "extend in place" note in `button.tsx`) match reality
  exactly.
- Confirmed via `gh issue view 15` that §1's verbatim quote of the issue text is accurate
  and complete, and that the plan's five deliverables (`Button` icon variant, `TextInput`,
  `Textarea`, `Checkbox`, `Select`) map 1:1 onto the issue's list with no gaps and no
  extras beyond the `placeholder` and icon-color judgment calls the plan itself already
  flags as open questions in §6.
- Confirmed `component-library-setup` (#14, the stated dependency) and `layout-primitives`
  are both already merged to `main` (visible in git log), so the plan's precedent
  citations (`131b911`'s `shadow-hard`/`cn` extraction, the layout-primitives "rule of
  three" note, `Panel`'s `Omit<..., "title">` pattern) are real prior art, not forward
  references to work that doesn't exist yet.
- Confirmed `Button` currently has exactly one consumer (`ui-demo-page.tsx`) — extending
  its variant union is additive/backward-compatible and touches no other call site, so the
  "extend in place" risk is genuinely low, not just asserted.
- Re-checked the `Checkbox` peer-sibling hit-testing behavior (real `<input>` topmost in
  DOM order but `opacity-0`; box and checkmark `<svg>` both `pointer-events-none` and
  layered after it) — this is a standard, correct pattern: `pointer-events: none` on the
  later-painted siblings lets clicks fall through to the input beneath rather than being
  captured by the visually-on-top decorative elements. No issue.
- Re-checked the `<select>` default-placeholder-selection claim (first `<option>` in DOM
  order is initially selected/displayed even when `disabled`, absent `value`/
  `defaultValue`/`selected`) — consistent with standard HTML `<select>` behavior; not
  re-litigating further since round 1 already treated this as verified.
- No new scope drift: re-diffed the plan's non-goals (§5) against the issue text again
  fresh — wiring into real pages, the spring-pop checkbox interaction, multi-select,
  `indeterminate`, `Field` composition, and validation styling are all correctly
  unrequested and correctly excluded; no over-scoping found. Under-scoping check: all
  five named primitives (Button icon variant, text input, textarea, checkbox,
  select/dropdown) are covered with concrete props/structure, not hand-waved.
- No new hidden assumptions found beyond the four already surfaced in §6 (Checkbox scope,
  Select placeholder, icon-button color, field-base.ts proactive extraction) — all four
  are genuinely judgment calls with no single correct reading of the issue text, and all
  are reasoned rather than silently decided.
- No new missing edge cases found in §4's test list on a fresh pass; the list already
  covers disabled-prevents-update, empty/zero-prop renders, controlled round-trips,
  className merge, and native-prop passthrough for every new component.
- No shared/external-state risk (frontend-only, presentational, no Prisma/server files
  touched, confirmed by `git status`-equivalent scope check) — consistent with round 1.

Both round-1 findings are resolved correctly and no new blocking or non-blocking issues
surfaced on a fresh full re-read. This plan is ready to build from.

VERDICT: APPROVED
