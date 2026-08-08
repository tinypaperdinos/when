# Refiner notes: update-node-version

## Round 1

### Verification performed (independent of the plan's own claims)

- Re-read `.github/workflows/ci.yml`: confirms it's the only workflow file in
  `.github/workflows/`, and `node-version: 20` is the only Node-version pin in it.
- Repo-wide search for `node-version`, `.nvmrc`, `.node-version`, `engines`, `Dockerfile`
  across the tree (excluding `node_modules`): no hits outside `package-lock.json`'s
  per-dependency `engines` metadata (which belongs to third-party packages, not this
  repo, and isn't something this ticket should touch).
- No `Dockerfile`, `render.yaml`, `fly.toml`, `Procfile`, or similar deploy config
  exists anywhere in the repo — so there's no deployment-side Node pin the plan missed.
- `.devcontainer/devcontainer.json` includes the `ghcr.io/devcontainers/features/node`
  feature with no version specified (defaults to latest/LTS at build time) — unpinned,
  so nothing to change there either. Consistent with the plan's "no other file
  references a Node version" claim.
- `README.md` has no Node-version mentions.
- Checked `apps/server/package.json`: Prisma `~6.19.3`, `@prisma/client` `~6.19.3`, no
  `better-sqlite3` or `@prisma/adapter-*` dependency, and `schema.prisma` uses the
  plain `provider = "sqlite"` (default Rust query-engine binary, not a Node native
  addon/N-API driver adapter). This matters because there's a real, documented class of
  Prisma+Node24 breakage (e.g. prisma/prisma#28624, `@prisma/adapter-better-sqlite3`
  failing to install on Node 24 because its native binary only ships up to
  NODE_MODULE_VERSION 131 vs Node 24's 137) — but this repo isn't on that adapter path,
  so that specific failure mode doesn't apply here. Prisma's default query engine talks
  over IPC rather than as a native Node addon, so it's less exposed to Node ABI bumps
  than an N-API-based driver would be. Prisma's own docs list `24.0+` as supported for
  the ORM. Net: the plan's "Prisma's native engine binaries are version-sensitive, so
  don't assume CI is fine, actually watch it go green" framing is directionally correct
  and appropriately cautious even though the single most severe known Node-24-breaks-
  Prisma issue doesn't apply to this repo's config. No dependency in
  `package-lock.json` declares an `engines.node` upper bound that excludes 24 (checked
  programmatically).

### Scope fidelity

Correct call. The GitHub issue is literally "Update node version" with an empty body;
the human clarified only the target version (24), not "also add engine enforcement" or
"also add version-manager config." The plan's one-line `ci.yml` change satisfies the
stated ask exactly. The "Scope boundary" section explicitly declines `engines.node` and
`.nvmrc`/`.node-version`, with reasoning that holds: `engines` would change `npm
install` behavior for every future contributor (a real behavioral change nobody asked
for), and a `.nvmrc` would be inert since nothing in this repo (no CI step, no
documented workflow) consumes it. Neither omission is scope creep avoidance for its own
sake — both have a concrete "why not" tied to actual repo behavior, not just "not asked
for." This is the right amount of restraint for a one-line issue; over-scoping into a
version-policy ticket would have been the wrong call here, not the right amount of
thoroughness.

### Hidden assumptions

None found that aren't already surfaced. The plan is explicit that a contributor
running an older local Node isn't blocked (calls this out under both "edge cases" and
"scope boundary" rather than silently accepting it) — that's the correct treatment of an
ambiguous requirement: surfaced, not silently decided.

### Missing edge cases / risk

The plan already identifies the one edge case that actually matters for a change like
this: CI must demonstrably go green on Node 24, not be assumed fine, specifically
because of Prisma's native-binary sensitivity. That's the right thing to flag and it's
specific rather than generic ("lint/typecheck/test/build must pass," not just "CI should
pass"). Independent research (above) confirms the underlying concern is real (Prisma has
a documented history of Node-version-specific native-binary breakage) even though this
repo's specific Prisma setup isn't on the highest-risk path (no driver adapter). No
changes needed here — the plan doesn't need to enumerate every possible failure mode,
it correctly identifies verification-not-assumption as the mitigation, which is the
right level of specificity for a one-line CI bump.

One minor, non-blocking observation for whoever implements/verifies this: Node 24 ships
a newer bundled npm than Node 20 did, which could in theory produce different `npm ci`
resolution behavior against the existing `package-lock.json` lockfile — in practice
`npm ci` is intentionally strict/deterministic from the lockfile regardless of npm
version, so this is very unlikely to matter, but it's covered by the same
"confirm CI actually goes green" step the plan already calls for, so no plan change is
needed.

### Existing codebase fit

Matches the existing pattern exactly (single `ci.yml`, `actions/setup-node@v4`,
version as a bare job-step input) — no new config file, no new tooling, no new pattern
introduced for a one-line bump.

### Verdict rationale

The plan is scoped correctly, its factual claims about the repo all check out under
independent re-verification, it surfaces the one real risk (CI-green-on-24, specifically
because of Prisma) with the right amount of specificity, and its scope exclusions are
justified by concrete repo behavior rather than hand-waved. No changes requested.
