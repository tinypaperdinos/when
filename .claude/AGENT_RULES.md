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
- **`Date` fields cross the tRPC boundary as plain strings, not `Date` objects** — no
  `superjson` (or equivalent) transformer is configured in `apps/server/src/trpc.ts` /
  `apps/web/src/trpc.ts`, so the type inferred from `AppRouter` says `Date` but the
  runtime value is a string. Before rendering, sorting, or calling a `Date` method on
  `dueDate`/`date`/`createdAt`/`updatedAt`, either add `transformer: superjson` to both
  `trpc.ts` files, or treat the value as a string explicitly (e.g. `new Date(entry.dueDate)`).
  Full reasoning: `tickets/_audits/2026-07-26.md`.
- **Styling** (decided 2026-07-26): Tailwind CSS. Extend the theme (colors, spacing,
  type scale, radii, etc.) as individual component/feature tickets need it — design
  choices land incrementally with the tickets that need them, not as one big future
  theming ticket.
- **Component library**: generic, reusable, tested components live under
  `apps/web/src/components/ui/` (buttons, inputs, date-time picker, tags, layout
  primitives, etc.), built and reviewed before the feature tickets that consume them.
  Browse them via a lightweight in-app demo route, not Storybook — Storybook is a
  deliberately deferred, tracked addition, not a rejected one; don't introduce it
  unprompted.

## Code comments

Credo: **make the code self-explanatory instead of adding bloated comments.** Good
naming and small, obviously-scoped functions are the default way to communicate intent —
reach for a comment only when that's not enough.

- Default to no comment. Only add one when it captures a non-obvious *why* — a hidden
  constraint, a rejected alternative and the reason it was rejected, a workaround for a
  specific bug, or behavior that would genuinely surprise a reader. If deleting the
  comment wouldn't leave a reader confused, delete it.
- Never write a comment that only makes sense with context the reader of the *code*
  doesn't have — a reviewer's name, a PR number, a review-thread back-and-forth, "per
  the ticket," "as discussed," "fixed per feedback." That context belongs in the commit
  message or the PR/review thread, not the source file — it rots the moment the
  conversation that produced it is no longer at hand.
- Don't narrate what the code does line-by-line; well-named identifiers already do that.
  A comment earns its place by adding information the code itself can't carry.
- No multi-paragraph explanations inline. If a decision needs that much justification,
  it belongs in `plan.md`/`ticket.md`/the commit message, with at most a one-line pointer
  left in the code if a future reader would otherwise be stuck.

## Ticket state

Each ticket lives in `tickets/<slug>/` — a plain top-level directory, deliberately *not*
under `.claude/`. Ticket-running agents should never need to read or write anything
under `.claude/agents/` or `.claude/skills/` — only `meta-auditor`, via the separate
human-invoked `/audit` flow, legitimately touches `.claude/`. Keeping ticket data out of
that tree means a permission prompt for `tickets/**` reads unambiguously as "ticket
work," and a prompt under `.claude/` reads unambiguously as "pipeline config change" —
don't blur that line by writing ticket state anywhere under `.claude/`.

`tickets/_audits/<date>.md` is the one exception not tied to a ticket slug (the
underscore prefix keeps it visually out of the way of real slugs) — `meta-auditor`'s
full findings/reasoning per audit run, kept out of this file. See "What meta-auditor
looks for" below.

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
  state updates this file. **In practice `done` is never written** — the pipeline's last
  write is `pr-opened`, right before `gh pr ready`; merging happens outside any agent's
  turn. A lingering `pr-opened` after merge is expected, not a bug — don't "fix" it by
  having some agent start writing `done` unilaterally; that's a deliberate pipeline
  change, not a documentation fix. Full reasoning: `tickets/_audits/2026-07-26.md`.

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

## Re-review scope (round 2+)

When `reviewer-code`/`reviewer-tests` are called again after a fix round, scope the
review to what changed since the last approved round — not a full re-audit. Measured
cost of skipping this on a real ticket: two reviewers each re-running the full check
suite and independently re-deriving the same verification, across two rounds, cost more
combined tokens than the fix itself.

- **Don't re-run `lint`/`typecheck`/`build` locally.** CI's `build` job already runs
  `lint`, `typecheck`, `test`, and `build` on every push, and the orchestrator checks
  `gh pr checks` before hand-off — re-running all four locally in every review round
  duplicates a check that's already green. Running the test suite once to confirm the
  new/changed tests pass is fine; the other three aren't needed unless the fix round
  touched something CI wouldn't catch.
- **Trust the prior round's approved findings.** Diff the two commits and verify only
  what the fix round actually changed; don't re-derive earlier findings from scratch or
  re-read every context file as if starting fresh.
- **Don't duplicate verification across the two reviewers.** If a fix commit's message
  already reports a manual check (e.g. mutation-testing a claim, then reverting it), one
  reviewer reproducing it once is enough — `reviewer-code` and `reviewer-tests`
  shouldn't both independently redo the same experiment.
- **`reviewer-code` stays on code/design/scope-fidelity.** Spinning up a browser
  (Playwright or otherwise) for visual QA duplicates jsdom-level test coverage and CI at
  real cost (installing a browser binary, running a dev server) for little incremental
  signal — only do it if a specific finding genuinely can't be confirmed any other way.

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
aren't written down anywhere.

This file is read fresh by every agent on every ticket — keep additions short and
distilled to "what to do." Full reasoning/evidence for each audit goes in its own file
under `tickets/_audits/<date>.md` instead (see `.claude/agents/meta-auditor.md` for the
exact split), which only gets read by someone deliberately digging into why a rule
exists, not by every agent every run.

## Audit log

One line per audit, pointing to the full write-up rather than inlining it:

- **2026-07-26**: First audit (single ticket's worth of history). Added the `superjson`/
  `Date` gap (Tech stack) and the `status.md` `done`-state clarification (Ticket state).
  Proposed and got human confirmation to tighten `reviewer-code.md` (already applied).
  Full findings and reasoning: `tickets/_audits/2026-07-26.md`.
