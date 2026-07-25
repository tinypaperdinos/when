# Agent pipeline rules

Shared conventions for every agent in the `/ticket` pipeline (planner, plan-refiner,
implementer, reviewer-code, reviewer-tests, fixer, meta-auditor). Read this file before
starting work. `meta-auditor` owns and updates this file — other agents should treat it
as read-only.

## Tech stack

Decided 2026-07-25. Don't deviate from this without the human explicitly changing it.

- **Repo layout**: npm workspaces monorepo, `apps/web` (frontend) and `apps/server`
  (backend), so the frontend can `import type { AppRouter } from "server"` for tRPC's
  type inference. Package manager: npm (matches `.github/workflows/ci.yml` and the
  allow-listed `npm *` commands in `.claude/settings.json`).
- **Frontend** (`apps/web`): Vite + React + TypeScript. Routing via TanStack Router.
  Data fetching via TanStack Query, wired to the backend through
  `@trpc/tanstack-react-query` — never hand-write a `fetch()` call or a manual type for
  API responses; if a component needs server data, it goes through a tRPC procedure.
- **Backend** (`apps/server`): Express + TypeScript, with tRPC as the API layer
  (`@trpc/server/adapters/express`). tRPC procedures are thin — input validation via Zod,
  then delegate to an OOP service class (e.g. `TaskService`, `EventService`). Business
  logic (validation rules, recurrence calculation, overdue checks) lives in the service
  classes, not in the procedure definitions. Don't introduce NestJS or a second
  routing/DI layer — tRPC already owns routing.
- **Database**: Prisma ORM, SQLite for now. Write queries so they don't rely on
  SQLite-specific behavior (avoid raw SQL where possible) since the migration path to
  Postgres is a one-line datasource change in `schema.prisma`, not a rewrite — don't
  break that.
- **Data model**: tasks and events share one entity with a `kind: "task" | "event"`
  discriminator (task: optional due date + completed flag; event: date/time, no
  completion state) — this keeps the calendar view and the due-date-sorted list querying
  one table. Tags are a many-to-many relation on that entity, not separate collections.
- **Calendar UI**: FullCalendar (`@fullcalendar/react`), chosen for its built-in drag-and-drop
  rescheduling. Stay on the free feature set (month/week/day/list views, drag-and-drop) —
  don't reach for resource-timeline/scheduler views, they require a paid license.

## Ticket state

Each ticket lives in `.claude/tickets/<slug>/`:

- `ticket.md` — the original scope/requirements as the human wrote them. Never edit this.
  It's the source of truth for "did we build the right thing."
- `plan.md` — current plan, owned by `planner`, revised in place across refine rounds.
- `refiner-notes.md` — one entry per refine round, appended by `plan-refiner`.
- `review-notes-code.md` / `review-notes-tests.md` — one entry per review round, each
  appended only by its own reviewer (`reviewer-code` / `reviewer-tests` respectively).
  Deliberately separate files, not a shared `review-notes.md`: the two reviewers run in
  parallel, and two agents appending to the same file concurrently is a real race — it
  happened on the very first ticket run through this pipeline, silently dropping one
  reviewer's findings. Never have two agents write to the same file in the same round.
- `status.md` — single current state line, one of: `planning`, `refining`, `implementing`,
  `reviewing`, `fixing`, `pr-opened`, `stuck-needs-human`, `done`. Whoever transitions the
  state updates this file.

## Branch and PR conventions

- Feature branch: `feat/<slug>`, cut from `main`.
- Never push directly to `main`. Never merge a PR — merging is the human's job.
- Open the PR as a draft as soon as the branch has a first commit, so CI runs early. Mark
  it ready-for-review only after the fix loop closes out.

## Iteration caps

- Plan refinement: max 2 revision rounds. If `plan-refiner` still says `REVISE` after
  round 2, set `status.md` to `stuck-needs-human` and stop — do not loop further.
- Review/fix: max 2 fix rounds. If blocking findings remain after round 2, set
  `status.md` to `stuck-needs-human` and stop.
- "Stuck" is a normal, expected outcome, not a failure to hide. Leave a clear reason in
  the relevant notes file.

## Division of responsibility

- `planner` and `plan-refiner` never write code.
- `reviewer-code` and `reviewer-tests` never edit code — findings only, each in its own
  file (`review-notes-code.md` / `review-notes-tests.md`).
- `fixer` applies fixes from review findings with fresh context, not `implementer` — this
  avoids anchoring on the original approach.
- Scope fidelity (does the diff actually satisfy `ticket.md`, not just "is the code good")
  is part of `reviewer-code`'s checklist, not a separate stage.

## What meta-auditor looks for

Run on demand via `/audit`, not part of the per-ticket loop. Looks across merged tickets
for: repeated review findings (same issue flagged across multiple tickets → add a rule
here instead of relying on every reviewer to catch it again), drift between what agents
actually did and what this file says they should do, and codebase conventions that
aren't written down anywhere. Updates land in this file, dated, with a one-line reason.

## Audit log

(No audits yet — `meta-auditor` appends one line here per run.)
