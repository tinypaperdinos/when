## reviewer-code — round 1

Reviewed `git diff main...feat/scaffold-project` against `ticket.md` and `plan.md`, and
ran the actual stack (`npm ci`, `npm run lint/typecheck/test/build`, `prisma migrate dev`,
seeding, starting both dev servers, hitting `tasks.list` through a direct `curl` and the
Vite proxy) rather than only reading the diff.

### Findings

1. **[blocking]** `apps/server/package.json`'s `dev` script —
   `"tsx --env-file=.env watch src/index.ts"` — crashes immediately with
   `ERR_MODULE_NOT_FOUND: Cannot find module '.../apps/server/watch'`. Reproduced with the
   exact pinned `tsx@4.23.1`. Root cause: tsx's CLI requires the `watch` subcommand to be
   the very first token; putting `--env-file=.env` before it makes tsx treat the literal
   string `watch` as the script path instead. Fix: reorder to
   `"tsx watch --env-file=.env src/index.ts"`. This breaks `npm run dev -w apps/server` and
   the root `npm run dev` (via `concurrently`) — exactly the command the ticket's "done"
   criteria and `README.md`'s new "Getting started" section depend on, and exactly the risk
   plan.md §7's last edge case told the implementer to manually verify before calling it
   done. After manually reordering to confirm, the whole chain genuinely works end-to-end
   (migrated + seeded rows come back through both the raw server and the web dev-server
   proxy) — so the underlying `db.ts` path-resolution fix from refiner round 1 is correct;
   this is purely a CLI-argument-ordering bug that appears to have shipped without the dev
   script actually being run.

2. **[non-blocking, judgment call]** Re-checked whether the missing `superjson` transformer
   (flagged non-blocking in `refiner-notes.md` round 2) is still fine to leave non-blocking
   given what's actually in this diff. Confirmed via manual `curl` that date fields do come
   back as plain strings while typed as `Date` — but nothing in the shipped code
   (`tasks-page.tsx`, its tests, `TaskService`, the router tests) ever reads or calls a
   `Date` method on those fields. Agree with the refiner: stays non-blocking for this round,
   re-flagged so it isn't lost before the next ticket that renders `dueDate`.

VERDICT: BLOCKING FINDINGS
