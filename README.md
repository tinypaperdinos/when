# when

A personal tool to organize tasks and due dates — task tracking, notes, and a calendar
view, in the spirit of TickTick but scoped to what one person actually needs.

## MVP scope

- Tasks with a due date
- Notes attached to tasks
- A task list sorted by due date
- Tags on tasks, to tell them apart (not separate collections/projects)
- A calendar view showing tasks and events, with drag-and-drop rescheduling
- Events: entries with a date/time but no due-date semantics — just a reminder, not
  something to complete

Not decided yet: auth, deployment target, mobile. Running locally for now; deploying
somewhere shared across devices is a later step, not part of the MVP.

## Stack

- Frontend: Vite + React + TypeScript, TanStack Router, TanStack Query (wired to the
  backend via tRPC)
- Backend: Express + TypeScript + tRPC, business logic in OOP service classes
- Database: Prisma ORM, SQLite for now, with a migration path to Postgres later
- Calendar UI: FullCalendar (free tier — month/week/day/list views, drag-and-drop)

Full conventions — repo layout, data model, coding rules — are in
`.claude/AGENT_RULES.md`.

## How this gets built

Implementation runs through an agent pipeline: plan → refine → implement → review → fix
→ PR, driven by the `/ticket` skill (`.claude/skills/ticket/`) and the agent definitions
in `.claude/agents/`. The human's role is writing tickets and doing the final PR review —
see `.claude/AGENT_RULES.md` for the full pipeline conventions.
