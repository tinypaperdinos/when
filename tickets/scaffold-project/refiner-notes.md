# Refiner notes: scaffold-project

## Round 1

Overall this is a strong, unusually well-researched plan — the version-pin research (§2),
explicit design-decision log (§5), and scope-boundary log (§6) are exactly the right shape
for keeping later reviewers from re-litigating settled calls. Per the launching agent's
note, the `typescript@~6.0.3` and `prisma`/`@prisma/client@~6.19.3` pins are treated as
justified and are not being flagged here.

Findings below, roughly in priority order.

### 1. (Should fix — risk to the ticket's core success criterion) SQLite relative-path
resolution is a known problem specifically in npm-workspaces monorepos, and the plan
doesn't address it

The plan sets `DATABASE_URL="file:./dev.db"` in `apps/server/.env.example` and separately
notes (§7) that `prisma migrate dev` will create `apps/server/prisma/dev.db`. But the
*runtime* `PrismaClient` (the `prisma-client-js` generator this plan deliberately pins to,
not a driver adapter) is documented to resolve a relative `file:` URL differently from how
the CLI resolves it — and there's an open, specifically-npm-workspaces-flavored Prisma issue
about this exact scenario ("SQLITE: npm workspaces hoisting breaks relative file path
resolving," prisma/prisma#9649), because hoisting can put the generated `@prisma/client`
somewhere other than `apps/server/node_modules`. Concretely, the risk is: `prisma migrate
dev` creates/migrates one `dev.db` (relative to `schema.prisma`'s directory), while the
Express server's `new PrismaClient()` at runtime resolves the same relative string against a
*different* base path (documented behavior points at "relative to the generated client
inside node_modules," not cwd and not the schema directory) — so the running server can end
up pointing at a different, unmigrated SQLite file. Depending on exactly where that lands,
this either throws `P2021: table does not exist` the first time `tasks.list` is called
(loud, at least easy to notice) or, worse, silently creates a second empty `dev.db`
somewhere that happens to have no tables asked of it yet — which wouldn't crash but would
undermine the "call it from a page in apps/web, end to end" proof this ticket exists for,
and would make the optional seed data (§4.7) invisible for reasons unrelated to the seed
script itself.

This is exactly the kind of "vague where it should be specific" gap that matters here: §7
lists "migration applies cleanly to a fresh SQLite file" as something to manually verify,
but that only checks the CLI's path resolution, not that the running server's `PrismaClient`
reads/writes the *same* file. The plan should either (a) make the datasource URL resolution
unambiguous — e.g. construct an absolute path in `src/db.ts` (`new PrismaClient({
datasourceUrl: \`file:${path.resolve(__dirname, "../prisma/dev.db")}\` })` or equivalent)
instead of relying on a bare relative string in `.env`, or (b) explicitly verify at
implementation time which directory the runtime client actually resolves against in this
repo's workspace layout and document/pin that, with a concrete check added to §7 ("start the
server, hit `tasks.list`, confirm it reads the *migrated* `dev.db`, not a fresh empty one at
a different path — don't just confirm a `dev.db` exists somewhere").

### 2. (Should address — scope question the plan didn't surface) `ci.yml` contains an
explicit self-instruction that §6's "no changes to ci.yml" decision doesn't engage with

`.github/workflows/ci.yml`'s placeholder branch (the `steps.pkg.outputs.exists == 'false'`
path) prints: *"This workflow is a placeholder — once the stack is chosen, remove the
exists-guards above (or rewrite this file for the actual tooling) so CI genuinely gates on
lint/test/build."* This ticket is precisely "the stack is chosen" moment. The plan's §6
justification for not touching `ci.yml` — "it already runs lint/typecheck/test/build guarded
by `--if-present` once `package.json` exists" — is true but conflates two different guards:
the *script-level* `--if-present` flag (fine to keep, handles a workspace missing a given
script) and the *job-level* `steps.pkg.outputs.exists` conditional that the comment is
actually asking to be removed (it exists only to keep CI green in an empty repo, and stops
being needed the moment a root `package.json` is committed). Leaving the job-level guard in
isn't functionally broken — CI will still install/lint/test/build correctly — but it means
this ticket walks past a written instruction left in the repo for exactly this moment
without acknowledging it. Either update `ci.yml` to drop the `steps.pkg.outputs.exists`
conditionals (small, low-risk, arguably the more scope-faithful reading of "the stack is
chosen") or add an explicit sentence to §6 explaining why leaving them is the right call
despite the comment. Right now the plan reads as if it didn't notice the comment, not as if
it weighed it and disagreed.

### 3. (Minor — plan completeness) Testing-tooling dependencies are implied, not listed

§4.6 requires rendering `TasksPage` (a real React component) in `apps/web`'s vitest suite
and asserting on rendered DOM output, and requires `apps/server`'s tests to run under
vitest — but §4.3/§4.4's dependency bullets never list `vitest`, a DOM test environment
(`jsdom`/`happy-dom`), or `@testing-library/react` for `apps/web`, nor `vitest`/`tsx`/
`@types/node`/`@types/express` for `apps/server` (the "standard Vite React-TS scaffold plus
X" and dependency-bullet lists elsewhere in the plan are otherwise exhaustive enough that
this reads like an oversight rather than an intentional "implementer's choice," unlike the
places the plan explicitly says "implementer's choice"). Not blocking — an implementer will
obviously add these — but worth naming explicitly given how precise the rest of the
dependency/version research is, so `reviewer-code` isn't left guessing whether an unlisted
package is a deviation from the plan or just an omission.

### 4. (Trivial) Model name `Entry` is an interpretation choice, stated less explicitly than
the field-name choices next to it

§4.2 explicitly flags field names (`dueDate`/`date`/`completed`) as "my own naming choice,
not gospel," but doesn't extend the same framing to the model name `Entry` itself (vs. e.g.
`Item`) even though it's the same kind of judgment call. Not worth a plan revision on its
own — just noting for completeness since the adjacent text specifically invites this kind of
challenge.

### Not flagging
- The TypeScript/Prisma version pins (§2) — treated as justified per the launching agent's
  note, and the research shown is credible and appropriately hedged ("re-check at
  implementation time").
- The `import type`-only "server" package trick (§4.5/§5) — this is a well-established
  pattern in tRPC monorepo examples; flagging only as a watch-item, not a defect: worth the
  implementer double-checking that `apps/web`'s `tsc -b`/`vitest` runs don't end up
  full-checking `apps/server`'s source tree (which uses Node/Express types that could
  collide with `apps/web`'s DOM-lib globals) as a side effect of the type-only import,
  since that's a known rough edge with this pattern in some TS/bundler-resolution
  combinations. Not asking for a plan change, just flagging so nobody's surprised if
  `apps/web`'s typecheck is slower or noisier than expected.
- Scope boundaries in §6 generally (no FullCalendar, no CRUD beyond `list`, no auth, no
  deploy config, no browser e2e) — these all match the ticket text and AGENT_RULES.md; no
  over-scoping or under-scoping found there.

## Verdict rationale

Finding #1 is the deciding factor: it's a concrete, evidence-backed (not hypothetical) risk
to the exact thing this ticket is supposed to prove ("a real HTTP round trip ... not
mocked/hardcoded data"), it's specific to this repo's exact topology (npm workspaces +
`prisma-client-js` + SQLite), and the plan currently has no mitigation or verification step
that would actually catch it before implementation is called done. Finding #2 is a smaller
but real scope question that should get an explicit answer rather than silence. Both are
fixable without restructuring the plan.

VERDICT: REVISE

## Round 2

Verified round-1 findings against the actual repo state (`.github/workflows/ci.yml`,
`.gitignore`, `README.md`) and against external documentation, not just against the plan's
own prose — see per-finding notes below. Also did one fresh pass for anything the round-1
review might have missed.

### Round-1 finding #1 (SQLite `file:` URL resolution) — genuinely fixed, not just claimed

The plan now has a real code fix: `apps/server/src/db.ts` exports a pure
`resolveDatasourceUrl(raw, baseDir = __dirname)` helper that rewrites a relative `file:...`
URL to an absolute path anchored at `path.resolve(baseDir, "../prisma", relativePath)`, and
`db.ts` passes `resolveDatasourceUrl(process.env.DATABASE_URL)` into `new PrismaClient({
datasourceUrl: ... })`. I independently re-checked the underlying claim (that the Prisma CLI
and the `prisma-client-js` runtime client resolve a relative `file:` URL against *different*
base directories under npm-workspaces hoisting, and that this is a real, confirmed,
long-standing Prisma issue — prisma/prisma#9649) via web search rather than taking the plan's
citation at face value, since round 1's entire verdict hinged on this claim being accurate.
It checks out: the CLI resolves relative to `schema.prisma`'s directory, the generated client
resolves relative to wherever `@prisma/client` physically lands inside `node_modules`
(hoisting-dependent), and the documented failure mode is exactly what the plan describes
(silent creation of a second, empty `dev.db` under `node_modules/.prisma/client/`, or a loud
`P2021`). Given `db.ts` is CommonJS (per §4.3's own stated tsconfig choice), `__dirname` is a
real value in both `tsx` dev and the `tsc`-built `dist/` output, and running the resolution
by hand: `path.resolve("apps/server/src", "../prisma", "./dev.db")` and
`path.resolve("apps/server/dist", "../prisma", "./dev.db")` both land on
`apps/server/prisma/dev.db` — the same directory the CLI resolves `file:./dev.db` against
(schema.prisma's own directory) since `.env` lives at `apps/server/.env`, one level up from
`prisma/`. The `db.test.ts` assertions described in §4.6 match the implementation shown in
§4.3, and §7 now requires proving the fix end-to-end at runtime (seed/migrate, hit
`tasks.list`, confirm the *migrated* rows come back), not just unit-testing the pure
function in isolation. This is a solid, verified fix — round 1's top concern is resolved.

One residual, non-blocking watch-item on this fix: it depends on `db.ts` actually running as
CommonJS (so `__dirname` exists) at runtime under `tsx`. The plan's tsconfig sets `"module":
"CommonJS"`, and `apps/server/package.json` is never given an explicit `"type": "module"`, so
Node/tsx's default (CommonJS when `package.json` has no `"type"` field) should apply — but
this is exactly the kind of assumption that's cheap to break by accident (e.g. an implementer
adding `"type": "module"` out of habit, or a `tsx`/Node version where the default shifts).
Worth a one-line explicit `"type": "commonjs"` in `apps/server/package.json`, or at minimum a
comment in `db.ts` noting the CommonJS dependency, so it fails loudly (`__dirname is not
defined`) rather than silently resolving wrong if that assumption ever breaks. Not blocking —
easy to catch in the §7 manual verification the plan already requires.

### Round-1 finding #2 (CI guard removal) — verified against the actual file, matches exactly

I read the real `.github/workflows/ci.yml` rather than trusting the plan's description of it.
The plan's "before" state (job-level `steps.pkg.outputs.exists == 'true'` guards on every
step, plus the placeholder warning step) matches the actual file exactly, and the plan's
target YAML in §4.1 is precisely that file with the guard step, the five `if:` conditions,
and the placeholder step removed — nothing more, nothing less. This is a correct, low-risk,
scope-appropriate fix. Confirmed addressed.

### Round-1 finding #3 (test-tooling deps) — addressed

`vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` are now explicit in
§4.4 for `apps/web`, and `vitest`, `tsx`, `@types/node`, `@types/express` are explicit in
§4.3 for `apps/server`. Confirmed addressed.

### Round-1 finding #4 (Entry naming) — addressed

§4.2 now has an explicit paragraph framing `Entry` as the plan's own naming choice, not a
requirement from `AGENT_RULES.md`, matching the framing already given to the field names.
Confirmed addressed.

### New finding (round 2) — should fix, not blocking: no `superjson` transformer, so `Date`
fields will lie about their runtime type across the tRPC boundary

Neither `apps/server/src/trpc.ts` (`initTRPC.create()`) nor `apps/web/src/trpc.ts`
(`httpBatchLink({ url: "/trpc" })`) configures a `transformer`. Without one, tRPC's default
JSON serialization turns `Date` values (the `Entry` model's `dueDate`, `date`, `createdAt`,
`updatedAt` — `dueDate` specifically being a field the ticket names explicitly: "task:
optional due date") into plain strings on the wire, but the TypeScript type inferred from
`AppRouter` on the client still says `Date`, because tRPC's type inference reflects the
procedure's actual return type, not what JSON serialization does to it at runtime. This is a
well-known, well-documented tRPC gotcha (confirmed current for tRPC v11 via a fresh search,
not just recollection) — the standard fix is `initTRPC.create({ transformer: superjson })` on
the server paired with `transformer: superjson` on the client's `httpBatchLink`, and it's
usually included by default in tRPC quickstarts for exactly this reason.

This directly contradicts the spirit of `AGENT_RULES.md`'s "never hand-write a manual type
for API responses" instruction: right now the *inferred* type is technically a lie for every
`Date`-typed field, which is worse than a hand-written type in one sense — it looks
trustworthy but isn't. Concretely: if a future call site (this ticket's or the very next
ticket's) does `task.dueDate?.toISOString()` or any other `Date`-method call trusting the
inferred type, it'll throw at runtime (`.toISOString is not a function` on a string).

I'm not making this a blocking finding, for two reasons specific to this ticket's actual
scope: (1) as currently planned, `tasks-page.tsx` isn't specified to render `dueDate` at all
(no styling/polish, per the ticket) — none of §1's "done" criteria depend on a `Date` field
surviving the round trip with the correct runtime type, so this doesn't threaten the ticket's
actual proof-of-wiring goal the way round-1's finding #1 did; (2) this is a two-line,
mechanically trivial fix to retrofit later (add `transformer: superjson` in both `trpc.ts`
files) that automatically covers every future procedure once added, so it isn't a
hard-to-reverse decision being made by omission.

That said, given how consistently this plan calls out and resolves exactly this class of
"well-documented framework gotcha nobody surfaced" (see finding #1 above, and the FullCalendar
version-mismatch research in §2), it's a real gap that it's absent here, on the one model that
ships with `Date` fields explicitly named in the ticket text. Recommend either adding
`transformer: superjson` to both `trpc.ts` files now (cheap, establishes the correct pattern
before more date-bearing procedures accumulate, consistent with how the plan already treated
the CI-guard cleanup — "this is the moment, don't defer it"), or, if the implementer chooses
to defer it, adding one sentence to §5/§6 stating that explicitly as a scope decision with
rationale, rather than leaving it as a silent gap. Flagging for `reviewer-code` regardless, in
case the plan isn't touched before implementation.

### Other checks (no new issues)

- Re-verified `.gitignore`'s claim that the existing `dist/`/`.env` lines (no leading slash)
  already cover `apps/web/dist`, `apps/server/dist`, `apps/server/.env` at depth — confirmed
  correct against the actual file.
- Re-verified `README.md`'s "not decided yet: auth, deployment target" language, which §6
  leans on to justify no-auth/no-deploy-config as out of scope — matches the actual file.
- Checked CI ordering (`npm ci` → lint → typecheck → test → build) against the `postinstall:
  "prisma generate"` dependency: since `apps/server`'s postinstall fires during `npm ci`
  (before any of the later steps), `@prisma/client` exists by the time typecheck/build run,
  and none of `generate`/lint/typecheck/build require `DATABASE_URL` to be set — no missing
  env-var problem in CI. Consistent with the plan's own "no automated test hitting a real
  SQLite database" scope decision (§6), since tests use fakes and never touch the DB in CI.
- Scope fidelity re-check against `ticket.md`: still a clean match — monorepo layout, both
  apps' stacks, the `Entry`/`Tag` schema, one `tasks.list` procedure called end-to-end from a
  page, no UI polish, no CRUD beyond `list`. The CI-guard cleanup is the one addition beyond a
  literal reading of the ticket text, and it's adequately justified (the file's own placeholder
  comment names this ticket's trigger condition) rather than being unexamined scope creep.

## Verdict rationale (round 2)

All four round-1 findings are addressed with real mechanisms — verified against the actual
repository files and against external documentation, not just accepted on the plan's word.
The one new item found this round (missing `superjson` transformer) is a legitimate,
well-evidenced gap in the same spirit as round 1's findings, but doesn't threaten this
ticket's actual "done" criteria and is cheap to fix later if not fixed now — it doesn't meet
the bar for spending the plan's last refinement round. Noted for `reviewer-code` to catch if
the plan isn't amended first.

VERDICT: APPROVED
