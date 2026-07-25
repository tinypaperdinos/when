---
description: Run the meta-auditor over recently merged tickets to update AGENT_RULES.md with recurring findings and drift.
argument-hint: (none)
---

Call `meta-auditor` (subagent_type: `meta-auditor`). It reads `.claude/AGENT_RULES.md`'s
audit log to see where it left off, looks at tickets merged since then, and updates
`AGENT_RULES.md` in place.

After it finishes, show the user a short diff-style summary of what changed in
`AGENT_RULES.md` (new rules added, why) rather than the full file.

Run this periodically — e.g. every few merged tickets, not after every single one. If
the auditor proposes edits to a specific agent's `.claude/agents/*.md` file rather than
just `AGENT_RULES.md`, surface that proposal to the user explicitly and apply it only
after they confirm, since that changes how every future ticket runs.
