GitHub issue #47: https://github.com/tinypaperdinos/when/issues/47

Title: Update node version

Note: issue body is empty. Clarified with the human (2026-08-08): target Node 24
(current active LTS, matches this dev environment's installed Node v24.18.0).
Currently `.github/workflows/ci.yml` pins CI to Node 20 via `actions/setup-node`
`node-version: 20`. No `.nvmrc`, `.node-version`, or `engines` field exists anywhere
in the repo today.
