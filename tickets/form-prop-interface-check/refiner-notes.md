# Refiner notes: form-prop-interface-check

## Round 1 — VERDICT: REVISE

Verified against `gh issue view 26`, `gh pr view 40 --json isDraft,mergeable,mergeStateStatus`,
`git diff main...feat/select-datepicker-refactor -- apps/web/src/components/ui/{select.tsx,README.md}`,
and the current `main` state of `button.tsx`, `text-input.tsx`, `textarea.tsx`,
`checkbox.tsx`, `card.tsx`, `badge.tsx`, `panel.tsx`, `section.tsx`,
`chevron-down-icon.tsx`, and every `<Button` call site under `apps/web/src/routes/`.

### 1. Select exclusion (§2 of the plan) — sound, well-verified, one residual risk worth naming

The plan's factual claims all check out:
- PR #40 is open, `isDraft: false`, `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN` —
  matches the plan's "open, not draft, ready for review" description.
- `select-datepicker-refactor`'s own `status.md` (on that branch) is `pr-opened`, i.e.
  it already went through this pipeline's implement+review loop, not a half-finished
  draft — this is stronger grounding for leaning on it than the plan's text alone
  conveys, worth citing explicitly in §2 if it isn't already.
- The diff genuinely replaces `extends Omit<SelectHTMLAttributes<...>, "multiple">`
  with a hand-curated `SelectProps` interface, and the rendered trigger label is now
  `selectedOption ? selectedOption.label : (placeholder ?? "")` — no `defaultValue`
  fallback hack remains, confirming the "ugly check" #26 names is genuinely gone in
  that diff.
- The README insertions from PR #40 land inside the existing `## Conventions` section,
  and `## Extending an existing component vs. adding a new one` is confirmed to be the
  last section in `main`'s current `README.md` (verified: `git show
  main:apps/web/src/components/ui/README.md | tail -20`) — so appending a new section
  after it, as §4.3 proposes, is genuinely non-overlapping regardless of merge order.
  This part of the scope call is solid.

**Residual risk, not fatal but worth stating plainly in the plan rather than leaving
implicit**: this ticket's claim to have "meaningfully addressed" #26 partly rests on a
different ticket's PR (opened for issue #30, not #26) landing as-is. If PR #40 is
significantly reworked in its own review/fix rounds, or never merges, #26's one named
concrete example would never actually get resolved by anything, and nothing in this
ticket's diff would surface that drift later (no tracking hook, no re-check). The plan
already recommends "Refs #26" over "Closes #26" pending that merge, which is the right
instinct — but that recommendation lives only in prose for "whoever opens the PR" to
remember. Given the pipeline's own PR-body convention, make this concrete: whoever
opens this ticket's PR should literally check `gh pr view 40 --json state,mergedAt`
at that moment and choose the closing keyword accordingly, not rely on remembering the
plan's reasoning. Not blocking by itself.

### 2. Button `type` default (§4.1) — this is scope creep and should come out (or be split)

Issue #26 is specifically about *prop interface restriction* — narrowing which props a
consumer can pass to eliminate an internal reconciliation hack (the Select
`defaultValue`/placeholder example, phrased as "limit that interface"). The `Button`
`type` default is a different kind of change entirely:
- It does not touch `ButtonProps`'s type signature at all (plan admits this: "runtime
  default, not an interface/breaking change").
- It fixes a *runtime behavioral footgun* (implicit native `type="submit"` inside a
  `<form>`), not an *interface* problem. There's no analogous "ugly internal check"
  being eliminated the way Select's was — the plan's own investigation confirms no
  internal workaround exists in `button.tsx` today.
- The plan itself verifies this bug is not currently live anywhere in the codebase
  (confirmed independently: `task-create-form.tsx`'s one in-`<form>` Button already
  passes `type="submit"` explicitly; `task-list-item.tsx`'s four Buttons and
  `ui-demo-page.tsx`'s Buttons are not inside any `<form>` — verified via
  `grep -n "<form" task-list-item.tsx task-create-form.tsx`). So this is a speculative,
  preventive fix for a bug that doesn't exist yet in any current call site, bundled
  into a ticket whose actual ask is a design-policy question about TypeScript prop
  surfaces.
- The plan's own §7, open question 2, already flags this exact tension and offers to
  drop it — which tells me the planner also isn't fully confident it belongs here.

Per `.claude/AGENT_RULES.md`'s scope-fidelity framing (explicitly named in this
review's brief: "flag both under-scoping and over-scoping... solving problems nobody
asked for"), and given resolving open ambiguities before implementation is exactly
plan-refiner's job rather than leaving it dangling into the fix/review loop: **drop
§4.1/§4.2 (and the corresponding README bullet in §4.3) from this ticket's diff.** The
finding itself is worth keeping — write it up as a documented, deliberate non-fix in
§6 ("out of scope, and why") the same way the plan already documents "requiring `type`
instead of defaulting" as considered-and-rejected — and either open it as its own
small follow-up ticket/issue (footgun found during a #26 audit, not part of #26
itself) or leave it for whoever eventually wraps `task-list-item.tsx`'s inline-edit
fields in a real `<form>`, since the plan's own reasoning is that it's currently inert
everywhere. Keeping this ticket's diff to "policy audit + doc" (and Select's
already-covered exclusion) makes the PR's story match its ticket exactly, which is the
thing #26 itself is implicitly asking this codebase to get better at.

### 3. Investigation claim in §3 is factually wrong for one sentence — fix before merge

§3 claims: "`Badge`, `Card`, `Panel`, `Section`, `ChevronDownIcon` are
presentational/layout, not form inputs, and were skimmed to confirm they don't quietly
extend `HTMLAttributes` in a way that's in scope here (**they don't**)."

This is false, verified by direct read:
- `card.tsx`: `export interface CardProps extends HTMLAttributes<HTMLDivElement>`
- `badge.tsx`: `export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>`
- `panel.tsx`: `export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title">`
- `section.tsx`: `export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title">`
- `chevron-down-icon.tsx`: `ChevronDownIcon(props: SVGProps<SVGSVGElement>)` — full
  native SVG prop pass-through, the same shape of pattern for a non-form element.

All five *do* extend a full native attributes interface — they just extend the
generic `HTMLAttributes`/`SVGProps`, not a form-control-specific one
(`InputHTMLAttributes`/`SelectHTMLAttributes`/`ButtonHTMLAttributes`). The plan's
underlying conclusion (out of scope, since #26's title says "form component pattern"
and none of these five is a form control) is still defensible, but the stated
verification ("they don't [extend HTMLAttributes]") is wrong and trivially
disprovable with one grep, which undermines confidence in the rest of the "verified"
claims in a plan that otherwise leans heavily on "I checked this." Fix the sentence to
something like "they do extend a generic `HTMLAttributes`/`SVGProps` pass-through, but
none is a form control, so they're out of #26's stated scope" — same conclusion,
accurate premise.

### Other checks performed, no issues found
- `TextInput`/`Textarea`/`Checkbox` current `main` source matches the plan's
  descriptions exactly (`Omit<..., "size">`, no `Omit` at all, `Omit<..., "type">`
  respectively).
- `checkbox.test.tsx`'s "forwards arbitrary native input props" test exists and asserts
  what the plan says it does.
- All four `<Button` call sites across the codebase are accounted for and match the
  plan's per-call-site behavior claims exactly.
- No backend/Prisma/tRPC surface touched — matches every prior `ui/`-only ticket's
  boundary.

## Verdict

Item 1 (Select exclusion) is sound with one risk worth stating more concretely (not
blocking alone). Item 2 (Button default) is genuine scope creep relative to #26's
actual ask and should be pulled out of this ticket's diff before implementation
starts. Item 3 is a small factual correction. Requesting a revision round for items 2
and 3; item 1 just needs the sharper PR-metadata instruction folded in.

VERDICT: REVISE

## Round 2 — VERDICT: APPROVED

Re-verified only the three round-1 findings and the diff's new shape, per the re-review
scope rule in `.claude/AGENT_RULES.md`.

### 1. Button type-default scope creep — resolved
§4 (task breakdown) now contains only §4.1, the `README.md` addition — no `button.tsx`
task remains. The finding itself is preserved, not dropped: §3 still records it as a
real (if currently inert) issue found during the audit, and §6 documents it as a
deliberate non-fix with the same two-part reasoning (wrong kind of change for #26's
prop-*interface* ask; not live at any current call site, verified via `grep -n "<form"
task-list-item.tsx task-create-form.tsx`). §5 goes further and explicitly warns
implementation not to fix it as a "while I'm in there" drive-by. This is exactly the
right outcome — the finding survives as documentation, the diff doesn't.

### 2. False §3 claim about Badge/Card/Panel/Section/ChevronDownIcon — resolved
§3 now reads "were also read directly and **do** each extend a generic native attributes
interface" followed by the accurate per-file breakdown (`CardProps extends
HTMLAttributes<HTMLDivElement>`, `BadgeProps extends HTMLAttributes<HTMLSpanElement>`,
`PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title">`, `SectionProps
extends Omit<HTMLAttributes<HTMLElement>, "title">`, `ChevronDownIcon(props:
SVGProps<SVGSVGElement>)`). Independently re-verified all five against current `main` —
matches exactly. The conclusion (out of scope because none is a form control) is
unchanged and still correctly reasoned; only the premise was wrong before, and it's now
fixed.

### 3. "Refs vs Closes #26" — resolved into a concrete mechanical step
§2's closing paragraph and §7 open question 1 both now specify the literal command
(`gh pr view 40 --json state,mergedAt`) to run at PR-open time, with the two branches
("Closes #26" if `mergedAt` is non-null, "Refs #26" otherwise) spelled out rather than
left as prose to remember. Re-ran the same command now: `{"mergedAt": null, "state":
"OPEN", "isDraft": false, "mergeable": "MERGEABLE", "mergeStateStatus": "CLEAN"}` — PR
#40 is still open, so if this ticket's PR were opened today the plan's own logic
resolves to "Refs #26," consistent with the plan's stated default.

### Sanity check: is a README-only diff a legitimate closure for #26?
Fetched the issue directly (`gh issue view 26 --json title,body`) rather than relying on
the plan's quote of it. Title: "Check form component pattern for prop interface
necessities." Body opens with "We might want to limit that interface..." — tentative,
posed as a question, with `Select` given as the one concrete illustration. This matches
the plan's framing exactly: it's an audit ticket, not a "ship a specific interface
change" ticket. With `Select` legitimately owned by PR #40 (verified independently in
round 1: real rewrite, already through this pipeline's own implement+review loop,
`status.md` on that branch is `pr-opened`) and `Button` correctly pulled out as a
different class of problem (runtime default, not interface, and not live anywhere), the
remaining diff is "audited every native-wrapper component, found no other interface
footgun, wrote the general policy down" — which is a genuine, non-degenerate answer to
the question #26 actually asked, not the ticket quietly doing nothing. The plan's own
§1 "what done means" is satisfied: every thin wrapper was checked (§3), every finding
was either fixed elsewhere (Select, via PR #40) or explicitly written up as a non-fix
(Button, §6), and the policy is landed in `README.md` (§4) at a location confirmed
non-overlapping with PR #40's own insertions (re-verified: `## Extending an existing
component vs. adding a new one` is still the last `##` section in `main`'s current
`README.md`).

### Other checks
No other part of the plan changed in a way that needs re-review under the re-review
scope rule — §2's Select-exclusion reasoning, §3's per-component findings for
`TextInput`/`Textarea`/`Checkbox`, and §4's README content are otherwise the same as
round 1, which was already found sound.

VERDICT: APPROVED
