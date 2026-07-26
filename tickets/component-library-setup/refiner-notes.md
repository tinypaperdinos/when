# Refiner notes: component-library-setup

## Round 1

Reviewed `plan.md` against `ticket.md` (pointer to GH issue #14) and the sibling backlog
issues it references (#15–#21), plus the actual current state of `apps/web` (router.ts,
vite.config.ts, vitest.config.ts, package.json).

### Scope fidelity — good overall

The three things issue #14 literally asks for are all present and none of the deferred
items (Storybook, custom theme) sneak back in:
- Tailwind installed, default theme only (no `@theme` block) — matches AGENT_RULES.md's
  "theme lands incrementally" rule.
- `apps/web/src/components/ui/` convention established with a README.
- In-app demo route (not Storybook) rendering every component + variant that currently
  exists.
- Confirmed via `gh issue view 21` that Storybook is tracked separately and explicitly
  "not urgent" — plan correctly treats it as deferred-not-rejected, matching
  AGENT_RULES.md wording almost verbatim.

No under-scoping found: nothing in issue #14's body is left uncovered. No unrelated
scope creep found: no dark mode, no a11y tooling, no server/Prisma changes, no auto-
discovery mechanism invented speculatively.

### Real finding: Button/#15 overlap not surfaced (please address)

`gh issue view 15` — "Component library: form primitives" — explicitly lists **"Button
(primary/secondary/icon variants)"** as part of its own scope, and depends on this
ticket (#14). The plan's proof-of-concept component is also a `Button` with
`variant: "primary" | "secondary"` (no `icon` variant), living at the exact path
(`components/ui/button.tsx`) that #15 will need.

The plan's §4 "out of scope" list enumerates "Input, DatePicker, Tags, layout
primitives" as deferred to already-tracked tickets, but conspicuously never mentions
that **Button itself is also formally tracked under #15** with a superset of variants.
This reads like the planner checked AGENT_RULES.md and the issue body but didn't cross-
reference the sibling issue list (#15–#21) for exact overlaps.

This is a real hidden-assumption gap, not a nitpick: whoever picks up #15 next won't
know from this plan whether they're expected to (a) extend this POC's `button.tsx` in
place (add the `icon` variant, wire in whatever design decisions #15 makes), or
(b) treat it as throwaway and rebuild. Either answer is fine, but it needs to be a
stated decision in the plan (a sentence in §3.3 and §4 is enough), not silence — this is
exactly the "picked one interpretation of an ambiguous requirement without surfacing it"
pattern this review is supposed to catch, and it's foundational work where getting the
handoff to the next ticket wrong causes real rework.

**Ask**: add one or two sentences making explicit that this ticket's `Button` is a
minimal POC that issue #15 is expected to extend/revisit (add `icon` variant, etc.),
not a finished component — so a future implementer doesn't have to guess.

### Minor / non-blocking observations

- `apps/web` has **two separate Vite configs**: `vite.config.ts` (app) and
  `vitest.config.ts` (tests), each with their own `plugins: [react()]` array. The plan's
  §2 context section and §3.5 file list only mention `vite.config.ts`. In practice this
  is fine — component tests don't import `index.css`, so the Tailwind plugin isn't
  needed in `vitest.config.ts` — but the plan should say so explicitly (one line) rather
  than silently omitting the file, so nobody wonders mid-implementation why it wasn't
  touched.
- Verified the plan's technical claims rather than taking them on faith:
  `tailwindcss@4.3.3` / `@tailwindcss/vite@4.3.3` are indeed the latest versions
  (checked via `npm view`), and Tailwind v4's automatic content detection scans from the
  directory containing the CSS entry file — since `index.css`, `button.tsx`, and
  `ui-demo-page.tsx` all live under `apps/web/src`, the known "monorepo content
  detection misses other packages" gotcha (real, see tailwindlabs/tailwindcss#13136)
  does not apply here, because this ticket doesn't introduce a separate `packages/ui` —
  everything stays inside `apps/web`. No action needed, just flagging that this was
  checked rather than assumed.
- The dev-only gating approach (`import.meta.env.DEV` conditionally spread into the
  route-tree array, discoverability link gated the same way) is technically sound and
  matches how Vite's `define`-based replacement + Rollup dead-code-elimination actually
  works. The plan is honest that "no `/dev/ui` in the prod bundle" is a manual/code-
  review check, not an automated one — reasonable for this ticket's size, and correctly
  flagged in §5 so `reviewer-tests` doesn't go looking for a test that isn't planned.
- Test conventions, file naming (kebab-case file / PascalCase export), and directory
  layout all match the existing `tasks-page.tsx` / `tasks-page.test.tsx` pattern — no
  new pattern introduced without reason.

VERDICT: REVISE

## Round 2

Re-read `ticket.md`, the revised `plan.md`, and my own round-1 entry above. Focused on
whether the round-1 finding was substantively resolved, then re-swept the rest of the
plan for anything the revision might have disturbed.

### Round-1 finding (#14/#15 Button overlap) — resolved, not cosmetic

The revision doesn't just add a throwaway sentence; it adds a real decision with
reasoning in four places that are all now consistent with each other:

- §1 ("What done means") flags up front that `Button` is not a throwaway artifact and
  points to §3.3.
- §2 (context) keeps the cross-reference to issue #15's exact scope wording (confirmed
  independently via `gh issue view 15`: "Button (primary/secondary/icon variants)" —
  matches the plan's quote verbatim).
- §3.3 states the decision explicitly (extend-in-place, not rebuild), gives two concrete
  reasons, names the rejected alternative (treat as disposable, have #15 rebuild) and why
  it was rejected, and adds a "practical implication for whoever picks up #15" bullet
  (add a third `variant` union member, icon-child handling, `aria-label` requirement)
  that gives the next implementer something concrete to act on rather than just a
  philosophical stance.
- §4 and §6 restate the same resolved decision so it isn't only findable in one spot.

This is exactly what round 1 asked for: not a particular answer, but an explicit,
reasoned decision instead of silent interpretation. Verified against the actual issue
text (`gh issue view 15`) rather than taking the plan's paraphrase on faith — the plan's
characterization of #15's scope is accurate.

### Minor round-1 observations — also addressed

- `vitest.config.ts`: §2, §3.1, and §3.5's "Not touched" section now all state explicitly
  why it's untouched (component tests don't import `index.css`, so the Tailwind Vite
  plugin isn't needed there). Verified by reading the actual file — it does have its own
  separate `plugins: [react()]` array as the plan describes, and the reasoning holds.
- Tailwind v4 monorepo content-detection gotcha: §2 now names the specific upstream issue
  (tailwindlabs/tailwindcss#13136) and gives the specific reason it doesn't apply here
  (`index.css`, `button.tsx`, `ui-demo-page.tsx` all under one `apps/web/src` tree, no
  separate `packages/ui`). This is correct and matches how Tailwind v4's automatic content
  detection actually works.

### Fresh re-check of the rest of the plan

- Verified `apps/web/vite.config.ts` and `apps/web/vitest.config.ts` against the plan's
  claims — accurate, no drift.
- Verified `apps/web/src/router.ts`'s current shape (`rootRoute.addChildren([tasksRoute])`)
  — the plan's conditional-spread approach for gating `/dev/ui` behind
  `import.meta.env.DEV` is compatible with this pattern and with how Vite/Rollup handle
  `import.meta.env.DEV` as a build-time constant.
  Re-confirmed issue #14's and #15's actual text via `gh issue view` — the plan's
  paraphrasing of both is accurate, no scope drift introduced by the revision.
- No new scope creep, no new hidden assumptions, no new missing edge cases introduced by
  the diff between round 1 and round 2 — the revision is additive (context + reasoning),
  not a restructuring that could have introduced new problems.

### One non-blocking suggestion (not a reason to withhold approval)

The `icon`-variant handoff decision currently lives only in `tickets/component-library-
setup/plan.md`. That file does persist in git history (per AGENT_RULES.md, ticket files
are committed, not gitignored), but whoever picks up #15 might not think to go read a
different ticket's plan file. A one-line comment in `button.tsx` itself (e.g. `// variant
union gains "icon" in #15 — extend, don't replace`) or a mention in the `components/ui/
README.md` would make the decision discoverable in-code instead of only in ticket
history. Worth doing when convenient, but the plan's decision is already correctly
resolved without it, so this isn't blocking.

VERDICT: APPROVED
