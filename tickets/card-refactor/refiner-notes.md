# Refiner notes: card-refactor

## Round 1

Verified against `gh issue view 29`, `.claude/AGENT_RULES.md`, and the current repo state
(branch `feat/card-refactor`, cut from `main`). Read `card.tsx`, `panel.tsx`,
`button.tsx`, `section.tsx`, `badge.tsx`, `checkbox.tsx`, `tag-input.tsx`, `index.css`,
`components/ui/README.md`, and the existing `*.test.tsx` files the plan proposes to
extend. All factual claims in the plan (literal shared `baseClasses` string between
`card.tsx`/`panel.tsx`, `shadow-hard`/`rounded-sm` presence/absence in `badge.tsx`/
`checkbox.tsx`/`tag-input.tsx`, Card/Panel's only current consumer being
`ui-demo-page.tsx`, Modal's non-existence in this branch's working tree) check out
against the actual files — nothing fabricated or stale.

### 1. Scope: Card + Panel — justified, and actually stronger than the plan states

The plan's rationale (identical literal `baseClasses` string, Panel would otherwise end
up looking more like Button than like the thing it's meant to distinguish itself from)
holds up. There's an even stronger piece of evidence the plan didn't cite: `gh issue
view 18` ("Component library: layout primitives (Section, Card, Panel)") shows Card and
Panel were designed and delivered together, as siblings, under one prior ticket — they
were never conceived as visually independent. That's more directly on-point than "they
happen to share a string today." Not a blocker, just note it strengthens an already-solid
call.

Minor completeness gap: `Section` is the third sibling from that same issue #18 and the
plan's §4 scope-decisions list never mentions it. I checked `section.tsx` —
`baseClasses = "space-y-3"`, no border/shadow at all, so it's correctly out of scope by
the same logic as `Badge`/`Checkbox`. But since a reader will naturally ask "what about
Section, the other layout primitive from the same original ticket?", it's worth one
sentence in §4 saying so explicitly, the same way Badge/Checkbox/TagInput each get one.
Cosmetic, not a required change.

Verdict on this axis: not scope creep. Justified, reversible, explicitly surfaced.

### 2. Picking a subset of the issue's suggestions ("sharp corners" + "shadow distance", not "Button solid") — justified

The issue's phrasing ("They should be distinguishable, e.g. by / sharp corners /
different shadow distance / Buttons not floating but solid") reads as illustrative
alternatives, not a required checklist — "e.g." plus a flat, unordered bullet list of
three different *mechanisms* to achieve the same one goal ("distinguishable"), not three
separate requirements. Cross-checked other issues in this tracker (`gh issue list`) —
issues here are consistently short, three-to-five-line problem statements, not spec'd
checklists with explicit "must implement all of the following" framing, so this reading
matches the repo's issue-writing convention, not just this plan's convenient
interpretation.

One observation in the plan's favor that I want on record since it's non-obvious: the
issue's own wording actually maps "floating" positively onto the Card-family and
negatively onto Button ("Buttons not floating but solid" — implying Card *should* look
floating, Button should not). The plan's chosen fix increases Card's shadow offset
(makes it look *more* floating) and leaves Button as-is — that's arguably *closer* to the
issue's own metaphor than redesigning Button would have been. The plan didn't spell this
out but it's worth the planner adding as a one-line reinforcement of the rationale in
§1, since it turns "we skipped a bullet" into "we implemented the bullet's underlying
intent through the other side of the same metaphor."

Verdict on this axis: correct call, well-reasoned, no under-scoping.

### 3. Modal flagged as out-of-scope risk instead of handled — call is right, but the risk write-up understates how live it is

Confirmed: `modal.tsx` genuinely does not exist on `feat/card-refactor` (cut from
`main`, which doesn't have it) — it only exists on `feat/feedback-components` (commit
`4c2d5ec`). So "this ticket cannot fix it now" is factually correct, not a shortcut.

However, I checked the actual PR state the plan doesn't check: `gh pr view 38` shows
`feat/feedback-components`'s PR is **open and not a draft** (`isDraft: false`,
`mergeable: MERGEABLE`) — i.e. already past its own review/fix loop and sitting ready for
a human to merge — while `card-refactor` is still in `refining` (round 1, plan not yet
approved, implementation not started). The plan's framing — "whichever of these two
branches merges to `main` **second** will leave Modal stuck" — reads as a coin-flip
between two symmetric possibilities. It isn't: given where each ticket actually is in
the pipeline right now, `feat/feedback-components` merging *before* this ticket's PR is
even opened is the more likely order, not a remote edge case.

That matters because the plan's only mitigation is "flag it in the PR description as a
known follow-up" — a passive note that depends on a human or a future ticket noticing it
later. A cheap, concrete fix: add a step (implementation-time, right before opening the
PR) to check `git log main -- apps/web/src/components/ui/modal.tsx` (or equivalent) —
if `feat/feedback-components` has merged to `main` by then, `modal.tsx` will already be
in this branch's history/mergeable-from-main, and the same one-line `baseClasses` edit
(`rounded-sm ... shadow-hard` → `rounded-none ... shadow-float`) should just be included
in this diff instead of deferred. If it hasn't merged yet, the plan's existing
fast-follow language stands as-is. This isn't asking the plan to reach into an unmerged
branch now (that would be the wrong call, and correctly rejected as such) — it's asking
for a live recheck at the moment the state described in §4 might no longer be true,
instead of treating a point-in-time `git log` read from planning as a fact good through
implementation.

This is the one substantive, actionable gap I'd want addressed before implementation
starts — not because the current call is wrong, but because the plan's own stated
reasoning ("there is no modal.tsx file here to edit") is time-bound and the plan doesn't
acknowledge that or give the implementer a way to notice if it stops being true.

### Other notes (non-blocking)

- `--shadow-float` token addition matches the documented convention exactly ("extend the
  theme ... as individual component/feature tickets need it" — `AGENT_RULES.md`, Tech
  stack / Styling). Good fit, not a new pattern.
- Regression tests (Card/Panel assert new classes present + old classes absent; Button
  asserts unchanged) are the right shape for a change of this kind — matches the
  colocated-test convention in `components/ui/README.md`.
- Blast radius check (`grep` for `<Card`/`<Panel` usage → only `ui-demo-page.tsx`) is
  accurate; re-verified independently, same result.
- No functional/data-layer edge cases apply — this is a presentational-only change, no
  async state, no partial-failure surface, nothing touching Prisma/tRPC.

## Verdict

One required change before this is ready to build: strengthen §4's Modal write-up with
a concrete implementation-time recheck step (see §3 above) instead of a static,
point-in-time "the file doesn't exist" claim, given PR #38 is already ready-for-review.
Everything else — Panel inclusion, the subset-of-suggestions call, edge cases, test plan,
codebase fit — is solid and doesn't need rework.

VERDICT: REVISE

## Round 2

Scoped to the two changes made since round 1 (per `AGENT_RULES.md`'s re-review rule),
not a full re-audit. Both verified against the current plan text and current repo/PR
state.

### 1. Section added to the out-of-scope list — resolved

§4 now has a "Section (the third sibling from issue #18) is out of scope, and correctly
so" bullet, same shape and rigor as the existing Badge/Checkbox/TagInput bullets
(cites `section.tsx`'s actual `baseClasses = "space-y-3"`, no border/shadow/radius, so
it was never part of the Button/Card overlap). This is exactly the gap flagged in round
1. Re-checked `section.tsx` directly — the factual claim still holds.

### 2. Modal risk: concrete implementation-time recheck step — resolved

§4's Modal write-up now includes an explicit, ordered procedure instead of a static
point-in-time claim: run `git log main -- .../modal.tsx` (or `git show
main:.../modal.tsx`) at the start of implementation, before touching Card/Panel, then:
- if PR #38 has merged into `main` by then → pull it into this branch and fold Modal's
  matching `baseClasses` update into this diff, with the same regression-test pattern
  extended to `modal.test.tsx`, noted in the PR description as an incidental inclusion;
- if not merged yet → fall back to the original passive PR-description flag.

This directly closes the round-1 gap: the plan no longer treats "no `modal.tsx` in this
branch" as a fact good through implementation, it gives the implementer a concrete,
cheap way to notice if that stops being true and act on it either way.

Re-verified current state as a sanity check (not required by the re-review scope rule,
but cheap and relevant since this is the exact risk in question): `modal.tsx` is still
absent from `main` (`git log main -- apps/web/src/components/ui/modal.tsx` empty), and
PR #38 is still open/not merged (`mergedAt: null`, `state: OPEN`). So the plan's
described state hasn't drifted since round 1 — the recheck step is armed correctly for
whichever way it resolves by implementation time.

No new issues introduced by either edit. Both are additive, don't contradict or
undermine anything reviewed in round 1 (scope-fidelity call on Card+Panel, the
subset-of-suggestions interpretation, edge cases, test plan, token/styling fit all still
stand as assessed).

## Verdict

Both required changes from round 1 are genuinely resolved, not cosmetically patched.
Nothing else outstanding. Ready to build.

VERDICT: APPROVED
