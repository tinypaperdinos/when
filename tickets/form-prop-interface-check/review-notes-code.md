## reviewer-code — round 1

Scope: `git diff main...feat/form-prop-interface-check` (34 insertions, 0 deletions, single
file: `apps/web/src/components/ui/README.md`). Cross-checked against `ticket.md` (GitHub
issue #26 pointer) and `plan.md`.

### Verification performed

1. **Diff is README-only.** `git diff --stat` confirms exactly one file changed, no
   component source touched (`button.tsx`, `text-input.tsx`, `textarea.tsx`,
   `checkbox.tsx`, `select.tsx` all untouched on this branch). Matches plan §4/§5's
   explicit "no code changes" commitment.
2. **Factual claims checked against `main`'s actual source** (not the plan's paraphrase):
   - `TextInput`: `extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">` —
     matches README's "`TextInput` omits native `size: number`" claim exactly, including
     the existing in-source comment explaining why.
   - `Textarea`: `= TextareaHTMLAttributes<HTMLTextAreaElement>`, no `Omit` — matches
     "no `Omit` at all" implicitly (README doesn't call this out per-component but the
     general "thin wrapper" framing holds).
   - `Checkbox`: `extends Omit<InputHTMLAttributes<HTMLInputElement>, "type">` — matches
     "`Checkbox` omits `type` because it's hardcoded."
   - `Button`: `extends ButtonHTMLAttributes<HTMLButtonElement>`, no `Omit` — matches the
     "thin wrapper" classification.
   - `Select` (pre-rewrite, current `main`): `extends
     Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple">`, with the exact
     `TODO(#26)` comment the README references — matches "`Select`, pre-rewrite, omitted
     `multiple`."
   - `checkbox.test.tsx` does contain a test titled "forwards arbitrary native input
     props onto the input, not the wrapper" (line 86) asserting `id`/`name` pass-through
     — matches the README's citation of it as evidence pass-through is intentional,
     tested behavior.
   All checked claims are accurate; nothing overstates what's actually in the codebase.
3. **Scope exclusion: `Select` deferred to PR #40.** Verified live via `gh pr view 40
   --json state,mergedAt,title,body`: state is `OPEN`, `mergedAt` is `null`. The ticket's
   own PR #41 body correctly says "Refs #26 (PR #40 not yet merged — update to Closes
   once it lands)" — matches the plan's §2/§7 decision procedure exactly (Closes only if
   PR #40 shows `MERGED` at PR-open time). No overclaiming that `Select`'s footgun has
   been fixed by *this* diff — the README section is explicit that "`Select`'s own
   prop-interface footgun... is already being addressed by the separate, unmerged PR
   #40," consistent with reality.
4. **`Button`'s `type`-default footgun is documented, not fixed.** Confirmed
   `button.tsx` is untouched on this branch, and separately confirmed the plan's
   supporting claim about current call sites still holds: `task-create-form.tsx`'s one
   in-`<form>` `Button` passes `type="submit"` explicitly (line 62), and all four
   `Button`s in `task-list-item.tsx` (lines 77, 80, 108, 111) are not inside any `<form>`
   element (no `<form` in that file at all). The README's phrasing ("it's a behavioral
   default, not a prop-interface restriction, so it's intentionally not addressed") does
   not claim the footgun was fixed — it correctly frames it as found-but-out-of-scope,
   consistent with plan §6.
5. **No merge conflict with PR #40's own `README.md` insertions.** Diffed
   `main...feat/select-datepicker-refactor -- apps/web/src/components/ui/README.md`:
   PR #40 inserts two bullets inside the existing `## Conventions` section (before `##
   Extending an existing component vs. adding a new one`). This ticket's new `##` section
   is appended after that section, at the end of the file. The two diffs touch disjoint
   line ranges regardless of merge order — confirmed, not just asserted.
6. **CI**: `gh pr checks 41` shows the `build` job (lint+typecheck+test+build) passing.
   No markdown-lint tooling exists in this repo to run separately for a docs-only change.

### Findings

None blocking. One non-blocking observation:

- **Non-blocking**: The new README bullet states, in the present tense, that `TextInput`/
  `Textarea`/`Checkbox`/`Button` should keep extending native attrs "and — as of the
  `select-datepicker-refactor` ticket — no longer `Select`," and later refers to "the
  rewritten `Select`." This describes PR #40's target state as settled fact inside a
  bullet that's otherwise phrased as current codebase guidance, even though PR #40 is
  still open/unmerged (confirmed above) and could still change in its own review/fix
  rounds. The plan (§2, "Residual risk") already explicitly accepts this as a known,
  stated limitation rather than something to solve here, so this isn't a new gap — just
  flagging that the wording reads slightly more definitive than the current repo state
  actually is. Not worth blocking on given the plan already flagged and accepted this
  risk; would only become a real problem if PR #40 is abandoned or substantially
  reworked, which is outside this ticket's control.

VERDICT: APPROVED
