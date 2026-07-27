# Refiner notes: shared-zod-schemas

## Round 1

Reviewed against GitHub issue #34 (`gh issue view 34`) and the current state of
`apps/server/src/services/{task,event}-service.ts`,
`apps/server/src/routers/{task,event}-router.ts`, and their four test files on
up-to-date `main` (43bd45b, post-event-crud/PR #33). Also spot-checked `zod` 4.4.3's
`.merge()` behavior directly (`node -e ...`) since the plan leans on it — confirmed it
merges shapes/validation as expected, no deprecation warning in the installed types, so
that particular risk the plan flagged in §3 is a non-issue in practice.

### Blocking: fabricated quote used to justify extending scope to the event pair

Plan.md §1 (line ~25) says:

> `event-service.ts`/`event-router.ts` (merged via PR #33 in parallel with this issue
> being raised — the issue asks that the pattern **"apply to, or at least not be
> undermined by,"** that pair too)

That quoted phrase does not appear anywhere in issue #34. The issue's actual `## Scope`
section says only:

> - Apply to the existing `task-service.ts` / `task-router.ts` pair as the reference
>   implementation.
> - Establish the pattern before/alongside the `event-crud` work (#7) so new entities
>   follow it from the start rather than repeating the duplication.

That's it — no sentence in the issue mentions the event pair needing the pattern
retroactively applied; it only says the pattern should be established *before/alongside*
event-crud so event-crud (then unbuilt) would follow it from the start. Since event-crud
has since merged without the pattern, "should we retrofit event-service/event-router
now" is a real, reasonable judgment call for this plan to make — I largely agree it's
the right call, since leaving `event-router.ts` with its own copy of the date regex and
`idInput` while `task-router.ts` gets the shared versions would immediately reintroduce
the exact drift risk this ticket exists to close. But the plan should own that as its
own reasoned extension of scope (the way it correctly does for the title/notes
non-sharing decision in §4, flagged explicitly as "a judgment call... stated with
reasoning above rather than left open") — not attribute it to the issue via a quote that
isn't there. As written, a reader (including reviewer-code checking scope fidelity
against `ticket.md`) could take the quotation marks at face value and believe the issue
explicitly authorized this, when it didn't.

Fix: rewrite that sentence to state plainly that extending to the event pair is the
plan's own inference from the issue's stated goal (title says "across service, router,
and form layers"; Problem section frames it as a general duplication problem, not
task-specific) and from the fact that event-crud landed in the interim without the
pattern — not a literal instruction from the issue. Content/decision can stay the same;
just stop citing it as a quote.

### Non-blocking observations

- **`schema-helpers.ts` location**: putting the one cross-entity shared file under
  `apps/server/src/services/` (there's currently no `lib/`/`shared/` directory in
  `apps/server/src`) is a reasonable call given the existing two-directory layout
  (`routers/`, `services/`), and it's not really router- or service-owned — it's input
  validation infrastructure. Not asking for a change, just noting it's a place where a
  future ticket might want a proper `apps/server/src/lib/` if more cross-cutting helpers
  show up. Fine to leave as-is for this ticket's scope.
- **Verified, not just assumed**: I independently confirmed the two "genuinely
  byte-identical" pieces the plan proposes extracting (the date regex and `idInput`)
  really are byte-identical between `task-router.ts` and `event-router.ts` on current
  `main` — no silent divergence the plan missed. Also confirmed `zod@4.4.3`'s
  `ZodObject.merge` is not deprecated in the installed version's type definitions, so the
  plan's proposed `idInput.merge(taskUpdateFields)` composition works as described.
- **Everything else checks out**: schema field definitions in §2.1 are byte-for-byte
  equivalent to what's currently inline in both routers (including the deliberately
  preserved task/event asymmetry on `dueDate`/`date` nullability); the plan's own list of
  edge cases in §3 (malformed date, empty/whitespace title, notes tri-state, missing
  `completed`, the destructuring type-compat risk, import-cycle risk) is thorough and
  accurate against the real test files; the "not doing" boundaries in §4 (not touching
  `apps/web`, not sharing `title`/`notes` cross-entity, not deriving scalar params, no new
  test files, no validation-rule changes, not touching `Tag`) all match what the issue
  actually asked for and what's actually in the codebase (no `Tag` service/router exists
  yet, confirmed). This is a well-scoped, low-risk refactor plan apart from the citation
  issue above.

VERDICT: REVISE

## Round 2

Focused re-check of the §1 fix per the orchestrator's brief, plus a scan for collateral
damage elsewhere in plan.md from that edit.

### §1 fix: confirmed sound

The revised §1 (lines ~22-38) no longer attributes the event-pair scope extension to the
issue via a fabricated quote. Re-verified against `gh issue view 34`:

- The only quoted fragment now is `"before/alongside"`, which **is** verbatim in the
  issue's `## Scope` section ("Establish the pattern before/alongside the `event-crud`
  work (#7) so new entities follow it from the start...") — a real quote, used correctly,
  in service of the accurate point that the issue talks about *new* entities following
  the pattern, not retroactively patching the now-merged event pair.
- The extension itself is now presented plainly as "this plan's own scope decision, not
  a literal instruction from the issue," with reasoning given (issue title/Problem
  section frame duplication as a general problem; leaving `event-router.ts`/
  `event-service.ts` un-refactored would reintroduce the exact drift risk the ticket
  exists to close) — same treatment/framing as the title/notes non-sharing judgment call
  in §4, which the sentence explicitly cross-references and which is accurate (§4 does
  contain that judgment call, stated the same way).
- It explicitly invites the refiner to push back and scope it back to task-only if
  disagreed with, rather than presenting the extension as settled. This is the correct
  fix for round 1's blocking finding — no residual misattribution.

### Scan for collateral changes

Re-read the full plan.md top to bottom. No sign the §1 edit disturbed anything else:
§2 (new/modified files, schema field defs), §3 (edge cases), and §4 (scope boundaries)
read identically in substance to what round 1 already verified against the live
codebase (`task-service.ts`/`event-service.ts`/`task-router.ts`/`event-router.ts` and
their four test files, still present and unchanged on disk — spot-checked via `ls`).
Cross-references between sections (§1 → §4's title/notes call, §3 → §2.1's asymmetry
note) are internally consistent. No new fabricated quotes or citations introduced
elsewhere in the document.

### Verdict

Round 1's sole blocking issue is resolved correctly and nothing else regressed. This is
the final round per the 2-round cap — approving.

VERDICT: APPROVED
