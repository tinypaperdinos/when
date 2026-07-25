---
name: ticket
description: Run a ticket through the full agent pipeline (plan, refine, implement, review, fix) up to an open PR, ready for human review. Use when the user invokes /ticket with a ticket description, a file path containing one, or a GitHub issue number/URL.
---

You are the orchestrator for this ticket. You do not write the plan, the code, or the
reviews yourself — you drive the pipeline by calling agents (via the Agent tool, using
`subagent_type` set to the agent's name) in sequence, and you own git/GitHub mechanics
and the state files. Read `.claude/AGENT_RULES.md` before starting.

The ticket input is whatever the user passed after `/ticket` — a plain description, a
file path, or a GitHub issue number/URL.

## 0. Scaffold

1. Resolve the ticket text: if the input is a file path, read it; if it's a GitHub issue
   number/URL, fetch it with `gh issue view`; otherwise treat it as the ticket text
   directly.
2. Derive a short kebab-case slug from it (e.g. `add-recurring-reminders`).
3. Create `.claude/tickets/<slug>/ticket.md` with the ticket text verbatim, and
   `.claude/tickets/<slug>/status.md` containing `planning`.
4. `git checkout -b feat/<slug>` from an up-to-date `main`.

If a folder for this slug already exists, resume from its current `status.md` instead of
starting over.

## 1. Plan

Call `planner` (subagent_type: `planner`) with instructions to read `ticket.md` and
write `plan.md`. Set `status.md` to `refining`.

## 2. Refine (max 2 rounds)

Loop up to 2 times:

1. Call `plan-refiner`. It appends to `refiner-notes.md` and ends with
   `VERDICT: APPROVED` or `VERDICT: REVISE`.
2. If `APPROVED`, break out of the loop and continue to step 3.
3. If `REVISE`, call `planner` again to update `plan.md` in light of the new
   `refiner-notes.md` entry, then repeat.

If still not `APPROVED` after 2 rounds: set `status.md` to `stuck-needs-human`, stop, and
tell the user exactly what's unresolved (quote the last refiner verdict). Do not proceed
to implementation.

## 3. Implement

Set `status.md` to `implementing`. Call `implementer` to build the approved plan on the
current branch (`feat/<slug>`). Once it finishes and has committed, push the branch and
open a **draft** PR:

```
git push -u origin feat/<slug>
gh pr create --draft --title "<short title from ticket>" --body "Ticket: <slug>. Built via the /ticket agent pipeline. See .claude/tickets/<slug>/ for plan and review history."
```

This lets CI start running while review happens. Set `status.md` to `reviewing`.

## 4. Review (max 2 fix rounds)

Loop up to 2 times:

1. Call `reviewer-code` and `reviewer-tests` (these are independent — call them in the
   same message so they run in parallel). Both append to `review-notes.md` and end with
   a verdict line.
2. If both say `APPROVED`, break out of the loop and continue to step 5.
3. If either has blocking findings: set `status.md` to `fixing`, call `fixer` to address
   them, then go back to step 1 for another review round (re-review the fixed diff, not
   just a rubber-stamp).

If blocking findings remain after 2 fix rounds: set `status.md` to `stuck-needs-human`,
leave the PR in draft, and tell the user what's still blocking (quote the last review
notes). Do not mark the PR ready.

## 5. Hand off to human

Check CI status on the PR (`gh pr checks`). If CI is red, treat that as a blocking
finding — don't hand off a PR with failing checks; loop back into step 4's fix flow.

Once reviewers approve and CI is green: `gh pr ready` to take it out of draft, set
`status.md` to `pr-opened`, and tell the user the PR is ready for their review with a
one-line summary of what it does and a link.

## Notes

- Never run `gh pr merge` or push to `main` — that's the human's job, always.
- If at any point an agent's output suggests the plan itself was wrong (not just the
  implementation), don't silently paper over it — surface it to the user rather than
  looping indefinitely between implementer and fixer.
