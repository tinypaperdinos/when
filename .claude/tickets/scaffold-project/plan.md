Scaffold the project per .claude/AGENT_RULES.md: npm workspaces monorepo (apps/web, apps/server). apps/web: Vite + React + TypeScript, TanStack Router, TanStack Query wired via @trpc/tanstack-react-query. apps/server: Express + TypeScript + tRPC (@trpc/server/adapters/express), Prisma with SQLite. Set up the Task/Event Prisma model (kind discriminator, tags relation) from AGENT_RULES.md. Add one tRPC procedure (e.g. tasks.list) and call it from a page in apps/web, end to end, to prove the whole chain works. No UI polish yet — this ticket is just getting the skeleton wired together.

---

# Plan: scaffold-project

_Revised after refiner round 1 — see the end-of-section notes marked **[round 1]** for what
changed and why. All four round-1 findings are addressed in place rather than as an
appendix, so the plan reads as one coherent document._

## 1. What "done" means

This is the first ticket in an empty repo (just `README.md`, `.claude/`, `.devcontainer/`,
`.github/`). "Done" is a working, from-scratch npm workspaces monorepo where:

- `npm install` at the repo root installs everything for both workspaces from one
  lockfile.
- `apps/web` is a Vite + React + TypeScript app using TanStack Router (code-based route
  tree, see §5 for why not file-based) and TanStack Query, fetching data through
  `@trpc/tanstack-react-query` — no hand-written `fetch()`, no hand-written response
  types.
- `apps/server` is an Express + TypeScript app exposing tRPC (`@trpc/server/adapters/express`)
  backed by Prisma/SQLite, with a `TaskService` class doing the actual query and a thin
  `tasks.list` procedure delegating to it. The runtime `PrismaClient` is demonstrably
  reading/writing the *same* SQLite file that `prisma migrate dev` migrated — not a
  same-named-but-different file elsewhere on disk (see §4.3, §7; this is a correctness
  requirement of "done," not a nice-to-have).
- The Prisma schema has the unified `Entry` model (`kind: "task" | "event"` discriminator)
  and a many-to-many `Tag` relation, per `AGENT_RULES.md`.
- Running `npm run dev` at the root starts both apps, and loading the web app in a browser
  shows a page whose content came from a real HTTP round trip through
  `apps/web → tRPC client → Express → tRPC router → TaskService → Prisma → SQLite`, not
  mocked/hardcoded data. An empty-but-real list (rendered as an explicit empty state) counts
  as proof — no seed data is required to satisfy "end to end," though a seed script is
  included as a nice-to-have to make manual verification more convincing (see §4.7).
- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` all pass at the
  root (these fan out to both workspaces), and CI (`.github/workflows/ci.yml`) actually gates
  on that — the placeholder job-level guards that only existed for an empty repo are removed
  as part of this ticket (see §4.1; **[round 1]**, this was previously left unaddressed).
- No UI styling/polish, no create/update/delete endpoints, no auth, no deployment config —
  explicitly out of scope per the ticket text (see §6).

## 2. Research notes that drive version choices (read before implementing)

I checked the npm registry directly (not just training-data assumptions, since this repo
apparently sits in mid-2026) and found two places where "latest" is actively a worse choice
than a slightly older major version, for reasons that matter for a scaffold ticket whose job
is to *work*, not to chase the newest release:

- **TypeScript**: `latest` is `7.0.2`, but `typescript-eslint@8.65.0` (the only realistic
  lint story for a TS monorepo) declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`.
  TS 7 is a ground-up native (non-JS) rewrite; using it would mean either no working
  TypeScript ESLint integration or fighting peer-dependency errors. **Decision: pin
  `typescript` to `~6.0.3`** (latest release still under the `<6.1.0` ceiling). Re-check
  `typescript-eslint`'s supported range at implementation time in case it's since added TS 7
  support — if so this constraint can be relaxed, but don't assume it without checking.
- **Prisma**: `latest` is `7.9.0`, but Prisma 7 made driver adapters mandatory (no more
  bare `DATABASE_URL` + `new PrismaClient()` for SQLite — requires
  `@prisma/adapter-better-sqlite3` and constructing an adapter), requires a new
  `prisma.config.ts` file with the datasource moved out of `.env`-driven convention,
  requires an explicit `output` path in the generator block (no more default
  `node_modules/@prisma/client`), and no longer runs `prisma generate` automatically after
  `migrate dev`/`db push`. Each of these is a reasonable direction for Prisma to take, but
  stacked together on day one of a scaffold ticket they're a lot of new-and-thinly-documented
  surface area for something whose only job here is "prove Prisma → SQLite works."
  **Decision: pin `prisma` and `@prisma/client` to `~6.19.3`** (latest 6.x), which uses the
  well-documented `prisma-client-js` generator, default `node_modules/@prisma/client`
  output, plain `.env`-based `DATABASE_URL`, and `new PrismaClient()` with no adapter.
  Node 24 (confirmed installed: `v24.18.0`) and TS 6.0.3 both satisfy 6.19.3's
  `engines`/peer requirements.

Everything else I checked (versions as of this research, `npm view <pkg> version`) had no
blocking incompatibility, so use whatever `npm install <pkg>@latest` resolves to at
implementation time: `vite` (8.x, requires Node `^20.19 || >=22.12` — satisfied by Node 24),
`react`/`react-dom` (19.x), `@tanstack/react-router` (1.x), `@tanstack/react-query` (5.x),
`@trpc/server`/`@trpc/client`/`@trpc/tanstack-react-query` (11.x, requires TS `>=5.7.2` —
satisfied by 6.0.3), `express` (5.x), `zod` (4.x, requires TS `>=5.7.2`), `eslint` (10.x),
`vitest` (4.x, requires Node `^20 || ^22 || >=24`).

**Not installing FullCalendar in this ticket** — see §6. In case a future calendar-view
ticket picks this up: at research time `@fullcalendar/core@latest` was `7.0.2` but
`@fullcalendar/daygrid`/`timegrid`/`list@latest` were still `6.1.21` with a peer dependency
on `@fullcalendar/core: ~6.1.21` — i.e. `@fullcalendar/react@latest` (which pulls core 7)
and the view plugins are currently on incompatible majors. Worth re-checking versions fresh
rather than trusting this note by the time that ticket is planned.

CI (`.github/workflows/ci.yml`) pins `node-version: 20` via `actions/setup-node@v4`, which
resolves to the latest 20.x patch. That should satisfy Vite/ESLint/Vitest's `^20.19`/`^20.19
|| ^20.13`-style floors, but since `npm` only warns (doesn't hard-fail) on an `engines`
mismatch by default, this isn't blocking even if it's slightly off — flagging so
`reviewer-code` doesn't need to re-derive this.

## 3. Repo layout after this ticket

```
package.json                 # root, workspaces: ["apps/*"]
package-lock.json            # single lockfile for the whole monorepo
eslint.config.js             # flat config, root, covers both apps
.gitignore                   # extended (see §4.1)
README.md                    # + "Getting started" section
.github/workflows/ci.yml     # MODIFIED — placeholder guards removed (see §4.1; [round 1])

apps/web/
  package.json               # name: "web"
  index.html
  vite.config.ts             # dev server proxy: /trpc -> http://localhost:3001
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vitest.config.ts
  src/
    main.tsx
    trpc.ts                  # createTRPCContext<AppRouter>(), TRPCProvider, trpc client
    router.ts                 # code-based route tree + createRouter()
    routes/
      root-route.tsx          # root layout route
      tasks-page.tsx           # index route component, calls tasks.list
      tasks-page.test.tsx
    vite-env.d.ts

apps/server/
  package.json               # name: "server" — imported by apps/web as a type-only dep
  tsconfig.json
  vitest.config.ts
  .env.example                # DATABASE_URL="file:./dev.db"
  prisma/
    schema.prisma
    migrations/                # committed, generated via `prisma migrate dev --name init`
    seed.ts                    # optional, see §4.7
  src/
    db.ts                      # PrismaClient singleton; resolves file: URLs to an
                                # absolute path so runtime reads/writes the same SQLite
                                # file the CLI migrated, regardless of npm-workspaces
                                # hoisting (see §4.3; [round 1])
    db.test.ts                 # unit test of the pure path-resolution helper in db.ts
    trpc.ts                    # initTRPC.create(), router, publicProcedure
    services/
      task-service.ts
      task-service.test.ts
    routers/
      task-router.ts
      task-router.test.ts
      app-router.ts             # appRouter + `export type AppRouter`
    index.ts                    # express app, mounts /trpc, app.listen
```

## 4. Task breakdown

### 4.1 Root tooling

- `package.json`: `"private": true`, `"workspaces": ["apps/*"]`, root scripts that fan out:
  `lint`/`typecheck`/`test`/`build` each run `npm run <script> --workspaces --if-present`;
  `dev` runs both apps concurrently (add `concurrently` as a root devDependency) —
  `concurrently -n web,server "npm run dev -w apps/web" "npm run dev -w apps/server"`.
- Root devDependencies: `typescript@~6.0.3`, `eslint`, `typescript-eslint`,
  `eslint-plugin-react-hooks` (applied only to `apps/web/**` via the flat config's file
  glob), `concurrently`.
- `eslint.config.js`: single flat config at the root (ESLint 10 is flat-config-only) that
  ignores `node_modules`, `dist`, `apps/server/prisma/migrations`,
  `apps/web/dist`/`apps/server/dist`, and applies `typescript-eslint`'s recommended config
  to both apps plus `eslint-plugin-react-hooks` recommended rules scoped to
  `apps/web/src/**`.
- `.gitignore`: add `*.db`, `*.db-journal`, `dist/` entries already broadly cover build
  output since the existing pattern has no leading slash (matches at any depth) — verify
  `apps/server/dist` and `apps/web/dist` are actually covered by the existing `dist/` line
  (they should be) rather than assuming. `.env` is already covered the same way, so
  `apps/server/.env` doesn't need a new line, only `apps/server/.env.example` gets
  committed.
- `README.md`: add a short "Getting started" section — `npm install`, `cp
  apps/server/.env.example apps/server/.env`, `npm run migrate -w apps/server` (or
  equivalent Prisma command, see §4.4), `npm run dev`, and which URL to open.
- **`.github/workflows/ci.yml` — remove the placeholder guards. [round 1, addresses finding
  #2]** The file's own comment says: *"This workflow is a placeholder — once the stack is
  chosen, remove the exists-guards above ... so CI genuinely gates on lint/test/build."* This
  ticket is that moment — a root `package.json` now exists unconditionally — so leaving the
  job-level guard in would mean walking past a written instruction left for exactly this
  point without acting on it. Concretely:
  - Delete the `Check for package.json` step (`id: pkg`).
  - Delete the `if: steps.pkg.outputs.exists == 'true'` condition from every remaining step
    (`setup-node`, `Install dependencies`, `Lint`, `Typecheck`, `Test`, `Build`).
  - Delete the final `No package.json yet` step entirely.
  - **Keep** the script-level `--if-present` flags on `lint`/`typecheck`/`test`/`build` —
    those are a different guard (handles an individual workspace lacking a given script,
    not "does a root package.json exist at all") and the refiner's note explicitly
    distinguishes them as fine to keep.
  - Target state:
    ```yaml
    name: CI

    on:
      pull_request:
      push:
        branches: [main]

    jobs:
      build:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4

          - uses: actions/setup-node@v4
            with:
              node-version: 20
              cache: npm

          - name: Install dependencies
            run: npm ci

          - name: Lint
            run: npm run lint --if-present

          - name: Typecheck
            run: npm run typecheck --if-present

          - name: Test
            run: npm run test --if-present

          - name: Build
            run: npm run build --if-present
    ```
  - This is low-risk: it doesn't change *what* CI runs on this repo's current contents
    (`package.json` exists unconditionally as of this ticket, so the guard was already
    always evaluating to the "true" branch) — it only removes dead conditional logic and the
    now-irrelevant placeholder warning step.

### 4.2 Prisma schema (`apps/server/prisma/schema.prisma`)

Per `AGENT_RULES.md`'s data model section:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Entry {
  id        String    @id @default(cuid())
  kind      Kind
  title     String
  notes     String?
  dueDate   DateTime? // task only: optional due date
  completed Boolean   @default(false) // task only
  date      DateTime? // event only: date/time
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  tags      Tag[]
}

model Tag {
  id      String  @id @default(cuid())
  name    String  @unique
  entries Entry[]
}

enum Kind {
  task
  event
}
```

Notes/decisions to flag explicitly (not hidden):

- SQLite has no native enum type; Prisma enforces `Kind` at the application/Prisma-Client
  layer, not via a DB constraint. That's a known, accepted limitation of the
  SQLite provider, confirmed still true as of research time — not a bug to fix here.
- **Model name `Entry` is my own naming choice, same as the field names below — not
  gospel.** `AGENT_RULES.md` says "tasks and events share one entity with a `kind`
  discriminator" — it describes the *shape* of the model, not its name. I picked `Entry`
  because it's neutral between "task" and "event" (unlike, say, `Item`, which is more
  generic/ambiguous, or `TaskOrEvent`, which is accurate but awkward as a Prisma model/table
  name). A later ticket can rename it if it turns out awkward in practice; that's not a
  regression of this ticket. **[round 1, addresses finding #4 — previously only the field
  names below had this framing, not the model name itself.]**
- Field names `dueDate`/`date`/`completed` are my own naming choice (AGENT_RULES describes
  the *shape*, not exact field names) — reasonable but not gospel; a later ticket touching
  the schema can rename if it turns out awkward, that's not a regression of this ticket.
- Tags use Prisma's implicit many-to-many (no fields on the join itself needed) —
  matches "many-to-many relation ... not separate collections."
- `completed` defaults to `false` even for `kind: "event"` rows (events don't have
  completion *semantics*, but giving the column a harmless default is simpler than making
  it nullable-with-meaning-per-kind; the service layer, not the schema, is what enforces
  that events ignore it — see `TaskService` below only ever reading rows where
  `kind: "task"`).
- Task: run `prisma migrate dev --name init` once during implementation to generate and
  commit the initial migration under `apps/server/prisma/migrations/`.

### 4.3 `apps/server` — Express + tRPC + Prisma

- `apps/server/package.json`: `"name": "server"`, `"private": true`, `"main"`/`"types"`
  both pointing at `src/routers/app-router.ts` (this is what lets `apps/web` do
  `import type { AppRouter } from "server"` — see §5 for why this is safe even though the
  module graph reachable from `app-router.ts` has runtime side effects like constructing a
  `PrismaClient`). CommonJS module target (`"module": "CommonJS"` in tsconfig) — kept
  simple rather than chasing ESM-first Node setups, since nothing here needs ESM, and it's
  also what makes `__dirname` available for the `db.ts` path resolution below.
  Dependencies: `@prisma/client@~6.19.3`, `express@^5`, `@trpc/server@^11`, `zod@^4`.
  DevDependencies: `prisma@~6.19.3`, `tsx`, `vitest@^4`, `@types/node`, `@types/express`
  **([round 1, addresses finding #3] — listed explicitly now: these were previously only
  implied by the dev/test scripts, not named as dependencies).** `cors` is deliberately
  **not** added — see §5 for the dev-proxy decision instead. `postinstall: "prisma generate"`
  so a fresh `npm ci` at the root produces the Prisma Client without a manual step (CI's
  `npm run lint`/`typecheck` steps would otherwise fail with "Cannot find module
  '@prisma/client'").
- **`src/db.ts` — absolute-path SQLite resolution. [round 1, addresses finding #1]**
  A bare relative `DATABASE_URL="file:./dev.db"` is ambiguous in this repo's topology: the
  Prisma CLI (`prisma migrate dev`) resolves a relative `file:` URL relative to
  `schema.prisma`'s own directory (`apps/server/prisma/`), but the generated
  `prisma-client-js` runtime client is documented to resolve the same relative string
  relative to *the generated client's location inside `node_modules`* — which npm-workspaces
  hoisting can put somewhere other than `apps/server/node_modules` (this is a known,
  specifically-npm-workspaces-flavored Prisma issue: "SQLITE: npm workspaces hoisting breaks
  relative file path resolving," prisma/prisma#9649). Left unaddressed, the CLI and the
  runtime client could end up pointing at two different SQLite files — the migrated one
  invisible to the running server, which would either throw `P2021: table does not exist` on
  the first `tasks.list` call, or (worse) silently create/read a second, empty `dev.db`
  elsewhere.
  Fix chosen: construct an unambiguous absolute path in `src/db.ts` itself, anchored to
  `db.ts`'s own location (which is fixed and known — `apps/server/src/` in dev via `tsx`,
  `apps/server/dist/` in a build — independent of wherever `node_modules/@prisma/client`
  happens to be hoisted to), rather than relying on a bare relative string and hoping the
  CLI and runtime agree on a base directory:
  ```typescript
  import { PrismaClient } from "@prisma/client";
  import path from "node:path";

  // Only rewrite sqlite `file:` URLs to an absolute path — a future Postgres
  // DATABASE_URL (e.g. "postgresql://...") is passed through unchanged, so this
  // does not undermine the "one-line datasource change in schema.prisma" migration
  // path described in AGENT_RULES.md.
  export function resolveDatasourceUrl(
    raw: string | undefined,
    baseDir: string = __dirname,
  ): string | undefined {
    if (!raw) return undefined;
    const match = raw.match(/^file:(.+)$/);
    if (!match) return raw;
    const relativePath = match[1];
    if (path.isAbsolute(relativePath)) return raw;
    // Resolve relative to apps/server/prisma/, matching how the Prisma CLI resolves
    // a relative `file:` URL in schema.prisma (relative to schema.prisma's own
    // directory) — anchored to this file's own location, not to node_modules, so
    // npm-workspaces hoisting can't move it out from under us.
    const absolutePath = path.resolve(baseDir, "../prisma", relativePath);
    return `file:${absolutePath}`;
  }

  export const db = new PrismaClient({
    datasourceUrl: resolveDatasourceUrl(process.env.DATABASE_URL),
  });
  ```
  `resolveDatasourceUrl` takes `baseDir` as a parameter (defaulting to `__dirname`)
  specifically so it's a pure, unit-testable function — see the `db.test.ts` entry in §4.6 —
  rather than something only verifiable by running the whole server. This is a code fix, not
  just a documentation/verification step, because a verification-only approach would leave
  the ambiguity in place for the next person who changes `.env` or moves a file; the manual
  verification in §7 still happens too, as a belt-and-suspenders check on the real dev
  database, but it's now confirming a deterministic code path instead of discovering
  undocumented framework behavior.
- `src/trpc.ts`: `const t = initTRPC.create(); export const router = t.router; export const
  publicProcedure = t.procedure;`.
- `src/services/task-service.ts`: `TaskService` class, constructor takes a `PrismaClient`
  (dependency-injected, not imported as a global inside the class) so it's mockable in
  tests. One method for this ticket: `list()` → `this.db.entry.findMany({ where: { kind:
  "task" }, orderBy: { dueDate: "asc" } })`. Business logic (the `kind: "task"` filter, the
  due-date sort) lives here, not in the router, per `AGENT_RULES.md`.
- `src/routers/task-router.ts`: `tasksRouter = router({ list: publicProcedure.query(() =>
  new TaskService(db).list()) })`. No input needed for `list` (no Zod input schema
  required, since there are no parameters yet) — flagging so nobody expects a Zod schema
  where there's nothing to validate.
- `src/routers/app-router.ts`: `appRouter = router({ tasks: tasksRouter }); export type
  AppRouter = typeof appRouter;`.
- `src/index.ts`: Express app; mounts `createExpressMiddleware({ router: appRouter })` at
  `/trpc`; `app.listen(process.env.PORT ?? 3001)`. No `cors` — the web app's dev server
  proxies `/trpc` (§5), so requests are same-origin from the browser's point of view.
- `package.json` scripts: `dev`: `tsx --env-file=.env watch src/index.ts` (Node's built-in
  `--env-file` flag, no `dotenv` dependency — implementer should verify `tsx` forwards this
  flag to the underlying Node process; if it doesn't, fall back to adding `dotenv` and an
  `import "dotenv/config"` at the top of `src/index.ts` rather than getting stuck on it).
  `build`: `tsc`. `start`: `node dist/index.js`. `typecheck`: `tsc --noEmit`. `lint`:
  `eslint .`. `test`: `vitest run`. `migrate`: `prisma migrate dev`. `postinstall`: `prisma
  generate`.

### 4.4 `apps/web` — Vite + React + TanStack Router/Query + tRPC

- `apps/web/package.json`: `"name": "web"`, devDependency `"server": "*"` (npm workspaces
  resolves this to the local `apps/server` package via the workspace symlink — used
  type-only, see §5). Standard Vite React-TS scaffold (which already brings in
  `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`) plus `@tanstack/react-router`,
  `@tanstack/react-query`, `@trpc/client`, `@trpc/tanstack-react-query`. **Test-tooling
  devDependencies, listed explicitly: `vitest@^4`, `jsdom` (DOM environment for
  `vitest.config.ts`'s `test.environment`), `@testing-library/react`,
  `@testing-library/jest-dom` (for readable DOM assertions in `tasks-page.test.tsx`).
  [round 1, addresses finding #3] — `jsdom` vs. `happy-dom` is the implementer's choice
  (both work with Vitest; `jsdom` is the more battle-tested default and is what's assumed
  here for `vitest.config.ts`, but `happy-dom` is a reasonable swap if it's faster in
  practice — not worth blocking on).**
- `vite.config.ts`: `server.proxy: { "/trpc": "http://localhost:3001" }` (dev-only; see §5,
  §6 for why this is fine given no deployment target is decided yet).
- `src/trpc.ts`: `export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();`
  plus a `@trpc/client` instance using `httpBatchLink({ url: "/trpc" })` (relative URL, so
  it goes through the Vite proxy in dev).
- `src/router.ts`: code-based (not file-based) route tree — `createRootRoute()` +
  one `createRoute({ path: "/", component: TasksPage })`, `createRouter({ routeTree })`.
  See §5 for why code-based routing was chosen over the file-based plugin for this ticket.
- `src/routes/tasks-page.tsx`: calls `useQuery(useTRPC().tasks.list.queryOptions())`,
  renders one of three states — loading, error, or the list (or an explicit "No tasks yet"
  empty state) — this is the page that proves the whole chain end to end. No styling
  beyond what's needed to visually tell the three states apart (ticket says no UI polish).
- `main.tsx`: wraps the app in `QueryClientProvider` → `TRPCProvider` → `RouterProvider`.
- Scripts: `dev`: `vite`. `build`: `tsc -b && vite build`. `typecheck`: `tsc -b`. `lint`:
  `eslint .`. `test`: `vitest run`.

### 4.5 Cross-cutting wiring rule (important for reviewer-code)

The **only** import from the `server` package into `apps/web` must ever be `import type {
AppRouter } from "server"`. A value import (e.g. accidentally importing `appRouter` itself,
or `db`) would try to pull Express/Prisma/Node-only code into the browser bundle. This is
safe as written because `import type` is fully erased at compile time (no JS emitted), but
it's a rule worth stating explicitly rather than trusting everyone to remember it — flag any
non-type import from `server` in `apps/web` as blocking.

### 4.6 Tests

Deliberately scoped to fast, deterministic unit/integration tests using fakes rather than a
real SQLite round-trip in CI — see §6 for why the real-DB proof is manual, not automated,
for this ticket. Test-tooling dependencies these rely on are listed explicitly in §4.3/§4.4
now (**[round 1]**).

- `apps/server/src/db.test.ts`: unit test for the pure `resolveDatasourceUrl` helper added
  in §4.3 (**[round 1, addresses finding #1]**) — asserts: (a) a relative `file:./dev.db`
  with a given `baseDir` resolves to `file:<baseDir>/../prisma/dev.db` as an absolute path;
  (b) an already-absolute `file:/some/abs/path.db` is returned unchanged; (c) a non-sqlite
  URL (e.g. `postgresql://...`) is returned unchanged, proving the future Postgres migration
  path isn't broken by this fix; (d) `undefined` input returns `undefined` (falls back to
  Prisma's own env resolution / errors the same way it would today).
- `apps/server/src/services/task-service.test.ts`: construct `TaskService` with a fake
  object shaped like `{ entry: { findMany: vi.fn() } }` (not a real `PrismaClient`).
  Asserts: (a) `list()` calls `findMany` with `where: { kind: "task" }` — proves events are
  excluded; (b) `list()` returns whatever the fake resolves with, unmodified; (c) `list()`
  on a fake resolving `[]` returns `[]` (empty case).
- `apps/server/src/routers/task-router.test.ts`: use `appRouter.createCaller({})` (tRPC's
  direct-call testing API, no HTTP needed) with a way to inject a fake `TaskService`/db —
  simplest option is constructing the router's dependency the same fake-Prisma way as the
  service test and asserting `caller.tasks.list()` returns the expected shape. Proves the
  router → service wiring, independent of the transport layer.
- `apps/web/src/routes/tasks-page.test.tsx`: render `TasksPage` with a test
  `QueryClient` and a `TRPCProvider` backed by a `@trpc/client` link that intercepts
  `/trpc` calls (e.g. a custom test link, or mock `fetch`/MSW — implementer's choice, but
  it must exercise the real `tasks.list.queryOptions()` call path, not just stub the
  component's data prop) — assert all three states render distinctly: loading, populated
  list (given fixture rows), and empty ("No tasks yet" or equivalent, given `[]`).
- No Playwright/Cypress browser e2e test — out of scope, see §6. "End to end" for this
  ticket is proven manually (§1) plus the router-level test that exercises the real
  `appRouter` (not a mock of it).

### 4.7 Optional: seed script

`apps/server/prisma/seed.ts` inserting 1-2 sample `Entry` rows with `kind: "task"`, wired
via Prisma's `package.json` `"prisma": { "seed": "tsx prisma/seed.ts" }` config, run via
`prisma db seed`. This is not required for "done" (an empty list is still valid end-to-end
proof, per §1) but makes manual verification during implementation/review more convincing
(you can actually see task titles render, not just an empty state). Non-blocking if skipped.
Also useful as part of the §7 manual verification of `db.ts`'s path resolution: seeding,
then confirming the seeded row shows up via `tasks.list` through the running server, is a
more convincing check than an empty list would be (an empty list is consistent with either
"correctly reading the migrated-but-empty table" or "reading a different, also-empty file").

## 5. Explicit design decisions (so refiner/reviewers don't flag these as unexplained)

- **Code-based TanStack Router instead of file-based routing.** File-based routing (via
  `@tanstack/router-plugin` + generated `routeTree.gen.ts`) is the documented default for
  larger apps, but for a single route proving wiring, it adds a build-time codegen step and
  a "should the generated file be committed or gitignored" decision that isn't worth making
  yet. Code-based routing (`createRootRoute`/`createRoute`/`createRouter` called directly)
  is an equally first-class, documented TanStack Router setup mode. Revisit when a second
  real page (task list proper, calendar) makes file-based routing's scaling benefits
  worth the extra moving part.
- **Vite dev-server proxy instead of `cors`.** Avoids adding a `cors` dependency and avoids
  reasoning about allowed origins for a purely local dev setup. This is dev-only — it says
  nothing about how a future deployed build serves the API, which is explicitly "not
  decided yet" per `README.md`. If a later ticket adds a production build/deploy path,
  it'll need its own answer to "how does the browser reach the API" (reverse proxy, same
  origin, explicit CORS, etc.) — not this ticket's problem to pre-solve.
- **`server` package "types"-only import trick.** Points `apps/server`'s `main`/`types`
  at `src/routers/app-router.ts` (a `.ts` source file, not a build output) so `apps/web`
  gets live type inference without a build step in between. Requires `apps/web`'s
  `moduleResolution` to be `"bundler"` (already Vite's recommended default) since it needs
  to resolve a package's `main` field straight to `.ts` source.
- **Pinned `typescript@~6.0.3` and `prisma`/`@prisma/client@~6.19.3`** instead of
  `@latest` — see §2 for the compatibility research behind both.
- **Absolute-path SQLite URL resolution in `src/db.ts`, instead of trusting a bare relative
  `file:` string. [round 1]** See §4.3 for the full mechanism. Chose a code-level fix over a
  verification-only mitigation because the risk (CLI and runtime client resolving a relative
  path against different base directories under npm-workspaces hoisting) is deterministic
  and reproducible, not environment-flaky — fixing it once in `db.ts` means every future
  developer/CI run gets the correct behavior automatically, rather than depending on someone
  remembering to manually re-check path resolution each time. Passing non-`file:` URLs
  through unchanged preserves the "Postgres migration is a one-line `schema.prisma` change"
  property from `AGENT_RULES.md` — this fix is additive/defensive for the SQLite case, not a
  structural change to how datasource URLs flow.
- **Removing the job-level guards from `.github/workflows/ci.yml` now, rather than leaving
  them for a later ticket. [round 1]** See §4.1. The file's own placeholder comment names
  "once the stack is chosen" as the trigger for this cleanup, and that's precisely what this
  ticket does — treating that comment as inert rather than acting on it would be
  inconsistent with the rest of this plan's stance of engaging with things explicitly rather
  than leaving them ambiguous.

## 6. Scope boundaries — deliberately not doing

- **No FullCalendar.** The ticket doesn't ask for a calendar view; `AGENT_RULES.md` only
  requires it "not be deviated from" once it's introduced, it doesn't require it exist yet.
  Installing it now would also hit the core-v7/plugins-v6 peer mismatch noted in §2 for no
  benefit. Leave for the ticket that actually builds the calendar view.
- **No create/update/delete/complete endpoints, no `EventService`.** The ticket explicitly
  asks for "one tRPC procedure (e.g. `tasks.list`)" to prove the chain — building out full
  CRUD now would be scope creep on a ticket about wiring, not features.
- **No auth.** Explicitly "not decided yet" per `README.md`.
- **No deployment/production hosting config.** Same — "running locally for now" per
  `README.md`. The dev-proxy decision in §5 is intentionally dev-only for this reason.
- **No UI styling beyond distinguishing loading/error/empty/populated states.** Ticket says
  "no UI polish yet."
- **No automated browser e2e test (Playwright/Cypress).** Not requested by the ticket or
  `AGENT_RULES.md`; the manual verification path in §1 plus the router-level test (§4.6)
  is the proof of "the whole chain works" for this ticket. A later ticket can add real
  browser e2e tooling if the project wants it — that's a tooling decision bigger than this
  scaffold ticket should make unilaterally.
- **No automated test hitting a real SQLite database.** Tests use fakes/mocks (§4.6) for
  speed and determinism in CI; the real Prisma↔SQLite connection is verified manually
  during implementation (run migrations, run both dev servers, load the page — see §7) and
  via the unit-tested `resolveDatasourceUrl` path-resolution logic in `db.test.ts`, rather
  than via an automated integration test that would need its own test-database lifecycle
  management (migrate-before-test, reset-between-runs). Revisit if a future ticket's
  behavior is risky enough to need it.
- **Not leaving `.github/workflows/ci.yml` untouched.** Earlier drafts of this plan treated
  "no changes to ci.yml" as a scope boundary; that was wrong (see §4.1/§5, **[round 1,
  addresses finding #2]**) — this ticket does modify it, specifically to remove the
  placeholder job-level guards, because this ticket is the "stack is chosen" trigger the
  file's own comment refers to. What's still out of scope: any *further* CI changes beyond
  that cleanup — no new jobs, no deploy step, no matrix builds, no caching beyond the
  existing `cache: npm` — those are separate concerns from "make the placeholder guard
  reflect reality."

## 7. Edge cases and error conditions (for reviewer-tests to check coverage against)

- `TaskService.list()` must exclude `kind: "event"` rows (covered by the mocked
  `findMany` call-args assertion in §4.6, not just an integration test that happens to have
  no event rows to accidentally exclude).
- `TaskService.list()` on an empty table returns `[]`, not `null`/`undefined`/an error —
  and the frontend must render a distinct empty state for `[]`, not treat it as loading or
  crash trying to `.map()` over `undefined`.
- Frontend must render a distinct error state if the tRPC call rejects (e.g. server not
  running) — shouldn't throw an unhandled promise rejection or leave the UI stuck on
  "loading" forever.
- `postinstall: "prisma generate"` must actually run on a clean `npm ci` — verify by
  deleting `node_modules` and re-running `npm ci` once during implementation, not just
  trusting the lifecycle-script wiring.
- The `import type`-only boundary between `apps/web` and `server` (§4.5) — verify a value
  import genuinely fails or is at least never introduced; this is a design invariant, not
  just a style preference.
- Migration must actually apply cleanly to a fresh SQLite file (no leftover state assumed)
  — verify by deleting `apps/server/prisma/dev.db` and re-running `prisma migrate dev`
  once during implementation.
- **The runtime `PrismaClient` must read/write the *same* SQLite file `prisma migrate dev`
  migrated — not merely "some `dev.db` exists somewhere." [round 1, addresses finding #1]**
  `db.ts`'s `resolveDatasourceUrl` (§4.3) is the code-level fix, and `db.test.ts` unit-tests
  its path-resolution logic in isolation, but that alone only proves the function is
  *correct*, not that it's *wired in correctly end-to-end*. During implementation's manual
  verification (§1), explicitly do this rather than just confirming a `dev.db` file exists
  somewhere: run `prisma migrate dev` (and, ideally, `prisma db seed` per §4.7), start the
  server, call `tasks.list` (via the browser page or `curl`), and confirm the returned rows
  match what was migrated/seeded — not an empty result that could equally mean "correctly
  reading an empty migrated table" or "silently reading a different, never-migrated file."
  If a seed row was inserted, seeing that exact row come back is the convincing proof; if
  skipping seeding, at minimum confirm no `P2021: table does not exist` error occurs and
  inspect (e.g. via `sqlite3 apps/server/prisma/dev.db ".tables"`) that the migrated file is
  the one being modified (check its mtime changes / row count changes if a write is tested).
- `tsx --env-file=.env watch src/index.ts` actually loading `DATABASE_URL` — if the
  `--env-file` flag isn't forwarded correctly by `tsx`, `PrismaClient`'s construction won't
  receive a `DATABASE_URL` to resolve at all (`resolveDatasourceUrl(undefined)` returns
  `undefined`, and Prisma falls back to its own env lookup, which will also fail the same
  way) — implementer should hit this during manual verification (§1) before calling it
  done, not assume it works.

## 8. Open questions

None blocking. The two version pins in §2, the design decisions in §5 (including the
`db.ts` absolute-path fix and the CI guard removal added in this revision), and the model
name choice called out explicitly in §4.2 are the judgment calls this ticket required; I've
made them explicitly rather than leaving them implicit, with rationale, so `plan-refiner`
can challenge the reasoning directly rather than discovering an unstated assumption. One
small non-blocking implementer's-choice flagged inline: `jsdom` vs. `happy-dom` for
`apps/web`'s Vitest DOM environment (§4.4) — either is fine, not worth blocking on.
