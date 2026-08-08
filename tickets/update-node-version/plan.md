# Plan: Update node version

## Done means

CI runs on Node 24 instead of Node 20. Concretely: `.github/workflows/ci.yml`'s
`actions/setup-node@v4` step has `node-version: 24`, and the `build` job (lint,
typecheck, test, build) still passes on that version. Nothing else in the repo
currently pins or references a Node version (confirmed by repo-wide search — see
Scope boundary below), so this is the only file that needs to change.

## Task breakdown

- **`.github/workflows/ci.yml`** (line 16): change `node-version: 20` to
  `node-version: 24` under the `actions/setup-node@v4` step. One-line diff, no
  other lines in that step need to change.

No other files touched. No new files. No schema/data changes — this is a CI
config change only.

## Edge cases / error conditions

There's no application logic here, so "edge cases" in the usual sense don't
apply. What's worth checking instead:

- **CI actually goes green on Node 24.** `actions/setup-node@v4` supports
  major-version-only specifiers like `24` (resolves to latest 24.x), so no
  further syntax change is needed beyond the version number. After pushing,
  confirm via `gh pr checks` (per the standard pipeline flow) that lint,
  typecheck, test, and build all pass on the new version — Node 20 to 24 is a
  big enough jump that a transitive dependency or a native binary (e.g.
  Prisma's engine) could behave differently, so this isn't purely a formality.
- **Local Node version mismatch isn't this ticket's problem.** Since there's no
  `.nvmrc`/`.node-version`/`engines` field, a contributor running an older
  local Node won't be blocked or warned — see scope boundary below for why
  that's deliberately left alone.

## Scope boundary (deliberately not doing)

- **Not adding `engines.node` to any `package.json`.** The issue title is
  "Update node version," singular and narrowly scoped, with an empty body —
  there's no signal the reporter wanted engine enforcement added, only that CI
  should track current LTS. Adding `engines` (plus deciding whether to also add
  `engineStrict`/`.npmrc` enforcement) is a separate, opinionated policy
  decision — e.g. it would start failing local `npm install` for anyone not on
  Node 24, which is a bigger behavioral change than "bump the version CI
  builds against." That's scope creep for a one-line issue; if the human wants
  local-install enforcement, that's a follow-up ticket.
- **Not adding a `.nvmrc` or `.node-version` file.** Same reasoning: nothing in
  the repo today reads either file (no `nvm use`/`fnm use` step in CI, no
  mention in docs), so adding one now would be inert config with no consumer,
  not a fix for the stated problem (CI pinned to an old version). If the repo
  later adopts nvm/fnm-based local version management, that's when a
  `.nvmrc` earns its place — bundling it into this ticket only widens the diff
  without changing behavior.
- **Not touching README or other docs** — none currently mention a Node
  version (confirmed by the repo-wide search), so there's nothing to update.

## Open questions

None — the human already clarified the target version (Node 24) when asked,
and the repo-wide search confirmed there's exactly one place to change.
