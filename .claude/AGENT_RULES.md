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
- **(2026-07-26 addendum) `Date` fields cross the tRPC boundary as plain strings, not
  `Date` objects** — `apps/server/src/trpc.ts` and `apps/web/src/trpc.ts` don't configure
  a `superjson` (or equivalent) transformer, so tRPC's default JSON serialization turns
  every `Date`-typed field (`dueDate`, `date`, `createdAt`, `updatedAt` on `Entry`) into a
  string on the wire, while the type inferred from `AppRouter` still claims `Date`. This
  was flagged twice during `scaffold-project` (refiner-notes.md round 2, review-notes-code.md
  round 1) as a real, well-documented tRPC gotcha, left non-blocking only because no code
  at the time called a `Date` method on those fields — it's still unresolved in the
  codebase as of this audit. Any ticket that renders, sorts, or otherwise calls a `Date`
  method on `dueDate`/`date`/`createdAt`/`updatedAt` (client- or server-side) must either
  add `transformer: superjson` to both `trpc.ts` files first, or treat the value as a
  string explicitly (e.g. `new Date(entry.dueDate)`) — don't trust the inferred `Date`
  type at the tRPC boundary until the transformer is added.

## Ticket state

Each ticket lives in `tickets/<slug>/` — a plain top-level directory, deliberately *not*
under `.claude/`. Ticket-running agents should never need to read or write anything
under `.claude/agents/` or `.claude/skills/` — only `meta-auditor`, via the separate
human-invoked `/audit` flow, legitimately touches `.claude/`. Keeping ticket data out of
that tree means a permission prompt for `tickets/**` reads unambiguously as "ticket
work," and a prompt under `.claude/` reads unambiguously as "pipeline config change" —
don't blur that line by writing ticket state anywhere under `.claude/`.

- `ticket.md` — the original scope/requirements. Never edit this. It's the source of
  truth for "did we build the right thing." If the ticket came from a GitHub issue, this
  is a short pointer (issue number + URL), not a copy of the body — read the issue with
  `gh issue view <number>` for the full text instead of relying on a duplicate. If the
  ticket came from inline text or a file, this holds the full text verbatim.
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
  state updates this file. **(2026-07-26 note)** In practice, under the current `/ticket`
  skill, the pipeline itself never writes `done` — the last write it makes is `pr-opened`
  (right before `gh pr ready`), and merging is explicitly the human's job, done outside
  any agent's turn. `scaffold-project`'s `status.md` still reads `pr-opened` even though
  its PR (#3) was merged. Don't treat a lingering `pr-opened` as a bug or a sign a ticket
  is stuck — it just means no agent has run against that slug since the human merged it.
  If this distinction matters later (e.g. wanting `tickets/<slug>/status.md` to reliably
  reflect merge state), that requires a deliberate pipeline change — a human follow-up
  step or an orchestrator check against `gh pr view --json state` — not something to
  quietly start doing inconsistently.

## Committing ticket state

Ticket files (`ticket.md`, `plan.md`, `refiner-notes.md`, `review-notes-*.md`,
`status.md`) are real, valuable history — commit them, don't gitignore them. But don't
commit them on every stage transition; that produces a stream of small "chore: status
now X" commits that clutter `git log` alongside the actual code commits. Instead, edit
them freely and leave them uncommitted through planning/refining/implementing/reviewing,
and commit the whole `tickets/<slug>/` folder in **one commit**, separate from code
commits (`implementer`'s and `fixer`'s commits stay their own commits, as real work),
at whichever of these happens first:
- right before the PR is marked ready for review, or
- the moment `status.md` is set to `stuck-needs-human`, so the escalation reason isn't
  left sitting unpushed in a local working tree.

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

## Review execution

- **(2026-07-26)** Reading the diff is not enough for `reviewer-code` — actually run the
  thing. On `scaffold-project`, `reviewer-code` round 1 caught a blocking bug
  (`apps/server`'s `dev` script crashing on startup because of tsx CLI argument order)
  only because it ran `npm ci`, the dev servers, and a real `curl` against the running
  server instead of just reading the diff — reading the `package.json` diff alone would
  not have caught it, since the broken line looked plausible on paper. `reviewer-tests`'s
  own instructions already say "verify by running the test suite" for test claims;
  `reviewer-code`'s instructions don't currently say the equivalent for runtime/build
  claims even though it has the same `Bash` tool. **Flagging for the human**: consider
  tightening `.claude/agents/reviewer-code.md` to explicitly instruct running
  lint/typecheck/build/dev commands relevant to the diff, not just reading it — this is a
  proposed edit to another agent's definition, not something `meta-auditor` is making
  unilaterally.

## What meta-auditor looks for

Run on demand via `/audit`, not part of the per-ticket loop. Looks across merged tickets
for: repeated review findings (same issue flagged across multiple tickets → add a rule
here instead of relying on every reviewer to catch it again), drift between what agents
actually did and what this file says they should do, and codebase conventions that
aren't written down anywhere. Updates land in this file, dated, with a one-line reason.

## Audit log

- **2026-07-26**: First audit. Only one ticket (`scaffold-project`, PR #3) has been through
  the actual `/ticket` pipeline so far, so this is a single-data-point pass, not a
  cross-ticket pattern search. Confirmed the two prior AGENT_RULES.md edits (PR #3's
  `review-notes-code`/`review-notes-tests` split, PR #10's `tickets/` relocation +
  batched-commit rule) already captured that ticket's process lessons — no further action
  needed there. Added three new items from re-reading `scaffold-project`'s full
  plan/refiner/review history against the current file: (1) the still-unresolved
  `superjson`/`Date`-serialization gap under Tech stack, since it will bite the first
  future ticket that renders a date field and wasn't written down anywhere agents would
  see it before now; (2) a clarifying note on `status.md`'s `done` state, since the
  current `/ticket` skill never actually writes it (confirmed by reading
  `.claude/skills/ticket/SKILL.md`) and `scaffold-project`'s `status.md` still reads
  `pr-opened` post-merge — not a bug, but worth being explicit about so it isn't
  "fixed" inconsistently later; (3) a flagged (not applied) proposal to tighten
  `reviewer-code.md` to explicitly require running the stack, since that's what caught
  `scaffold-project`'s one blocking finding and the instruction only exists for
  `reviewer-tests` today. PRs #1, #2, #10 were orchestrator-direct changes with no
  ticket folder, per the launching agent's note — nothing to audit there beyond what's
  already reflected in this file's edit history.
