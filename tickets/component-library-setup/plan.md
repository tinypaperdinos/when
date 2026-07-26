# Plan: Component library setup (issue #14)

## 1. What "done" means

This is foundational/infra work, not a feature. Done means:

- Tailwind CSS is installed and wired into `apps/web`'s Vite build (dev server and
  production build both produce Tailwind-processed CSS), using the **default theme**
  (no custom colors/spacing/type scale — per AGENT_RULES.md that's added incrementally
  by later tickets, not here).
- `apps/web/src/components/ui/` exists as the established convention directory for
  generic, reusable components, with a short `README.md` in that directory documenting
  the convention (naming, colocated tests, how a new component gets added to the demo
  route) so later component tickets have something concrete to follow.
- A lightweight, code-based (TanStack Router) **in-app demo route** exists that renders
  every component currently in `components/ui/` along with its variants, reachable by
  running the dev server and navigating to it. Not Storybook.
- One component (`Button`, with `primary`/`secondary` variants and a couple of sizes)
  exists to prove the whole chain works end-to-end: Tailwind classes render correctly,
  the component lives in the right place, and the demo route actually renders it. This
  `Button` is **not** a throwaway demo artifact — see §3.3 for why it's meant to become
  the real, permanent Button that issue #15 ("Component library: form primitives")
  extends with an `icon` variant, rather than something #15 rebuilds from scratch.
  Building out the rest of the real component library (everything beyond this one
  component) is explicitly future tickets' work.
- CI (`lint`, `typecheck`, `test`, `build` — see `.github/workflows/ci.yml`) stays green.

Non-goals for "done" (see §4): a full component set, Storybook, custom theme tokens,
auto-discovery of components for the demo route, any enforcement mechanism beyond a
README + code review.

## 2. Context / what exists today

- `apps/web` is Vite + React 19 + TypeScript, routing via **code-based** TanStack Router
  (`src/router.ts` builds a `rootRoute` + child routes via `createRoute`/`addChildren`,
  not file-based routing). Current routes: `RootRoute` (just an `<Outlet />`) and
  `TasksPage` at `/`.
- No CSS file exists anywhere in `apps/web/src` yet — `index.html` has no stylesheet,
  `main.tsx` imports no CSS. This is a genuinely blank slate for styling.
- `apps/web/package.json` has no `tailwindcss` dependency yet.
- `apps/web` has **two separate Vite configs**: `vite.config.ts` (the app) and
  `vitest.config.ts` (tests), each with its own `plugins: [react()]` array. This ticket
  only adds the `@tailwindcss/vite` plugin to `vite.config.ts` (§3.1) — `vitest.config.ts`
  is deliberately left untouched, because component tests render components directly with
  Testing Library and never import `index.css`, so nothing under test needs Tailwind's
  Vite plugin to be present in the test config. Called out here explicitly so it isn't
  read as an oversight.
- Test convention (from `tasks-page.test.tsx`): Vitest + Testing Library, colocated
  `*.test.tsx` next to the component/route it tests, `render` wrapped in whatever
  providers the component needs.
- File naming convention in `src/routes/`: kebab-case filenames (`root-route.tsx`,
  `tasks-page.tsx`), PascalCase named export for the component.
- `eslint.config.js` restricts `apps/web/src/**` from value-importing the `server`
  package — irrelevant here, no server code touched.
- Latest available versions: `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3` — Tailwind
  v4's Vite plugin is CSS-first config (no `tailwind.config.js`/PostCSS needed for the
  default theme; content/source detection is automatic via the Vite module graph).
  Verified this doesn't run into the known "monorepo content detection misses other
  packages" gotcha (tailwindlabs/tailwindcss#13136): that issue applies when the CSS
  entry file and the components using Tailwind classes live in different
  packages/workspaces. Here, `index.css`, `button.tsx`, and `ui-demo-page.tsx` all live
  under the single `apps/web/src` tree, so automatic detection covers them without any
  extra `@source` configuration.
- **Cross-reference with sibling backlog issues (#15–#21):** issue #15, "Component
  library: form primitives," depends on this ticket and lists `Button
  (primary/secondary/icon variants)` as part of its own scope. This overlaps directly
  with the proof-of-concept `Button` built here — see §3.3 for how this plan resolves
  that overlap.

## 3. Task breakdown

### 3.1 Install Tailwind CSS (default theme)

- Add `tailwindcss` and `@tailwindcss/vite` as devDependencies in `apps/web/package.json`
  (build-time only, no runtime import in shipped app code — matches how `@vitejs/plugin-react`
  is already classified).
- `apps/web/vite.config.ts`: add the `@tailwindcss/vite` plugin to the `plugins` array
  alongside `react()`. (`vitest.config.ts` is not touched — see §2 for why.)
- New file `apps/web/src/index.css` containing just `@import "tailwindcss";` — no
  `@theme` block, since we're deliberately using the default theme (per AGENT_RULES.md,
  theme extension happens incrementally in the tickets that need it).
- `apps/web/src/main.tsx`: add `import "./index.css";` before the render call.
- No `tailwind.config.js`/`postcss.config.js` file — Tailwind v4's Vite plugin doesn't
  need one for default-theme, automatic-content-detection usage (see §2 for why the
  monorepo content-detection gotcha doesn't apply here). If a later ticket needs a
  `@theme` block or explicit `@source` globs, that's added when it's needed, not
  speculatively now.

### 3.2 `apps/web/src/components/ui/` convention

- Create the directory with a `README.md` (short, not a design doc) covering:
  - What belongs here: generic, reusable, presentational components (buttons, inputs,
    date-time picker, tags, layout primitives, etc.) — not feature/page components.
  - Naming: kebab-case filename, PascalCase named export (matches `src/routes/`
    convention already in the repo) — e.g. `button.tsx` exports `Button`.
  - Every component gets a colocated `*.test.tsx` (matches existing `tasks-page.test.tsx`
    pattern).
  - New components must be added to the demo route (`src/routes/ui-demo-page.tsx`) so
    they stay visible for visual review — manual registration for now (see §4 for why
    auto-discovery is deliberately out of scope).
- This directory + README is the entire "enforcement" mechanism for this ticket — no
  ESLint rule, no CI check requiring components to be under `ui/`. Explicitly a
  documentation convention, not a technical guardrail (see §4).

### 3.3 `Button`: proof-of-concept *and* the real component #15 extends

- New files: `apps/web/src/components/ui/button.tsx`, `.../button.test.tsx`.
- `Button` takes a `variant` prop (`"primary" | "secondary"`, default `"primary"`) and a
  `size` prop (`"sm" | "md"`, default `"md"`), renders a native `<button>` with
  Tailwind utility classes switched on those props, forwards the rest of standard
  `<button>` props (`onClick`, `children`, `disabled`, etc.) via prop spreading.
- **Decision on the #14/#15 overlap (see §2 for how it surfaced):** issue #15 lists
  `Button (primary/secondary/icon variants)` as part of its own scope. This plan treats
  the `Button` built here as **the real, permanent component**, not a throwaway demo
  artifact — issue #15 is expected to *extend* `components/ui/button.tsx` in place (add
  an `icon`/icon-only variant, and whatever other refinements #15's own scoping turns up
  for text inputs/checkbox/select conventions) rather than delete and rebuild it. This is
  the more sensible reading for two reasons: (1) `primary`/`secondary` are exactly the
  variants #15 needs anyway, so building them once here and extending later avoids
  redoing identical work; (2) rebuilding from scratch would also mean redoing this
  ticket's colocated test suite and demo-route registration for no benefit. The
  alternative (treat this `Button` as disposable, have #15 delete and re-author it) was
  considered and rejected — it would be pure rework with no quality upside, since nothing
  about this ticket's Button is a hack that needs undoing (it's built with the same
  conventions #15 would use anyway).
  - Practical implication for whoever picks up #15: `button.tsx`'s `variant` union type
    only needs a third member (`"icon"` or similar) added, plus whatever markup/props an
    icon variant needs (e.g. accepting an icon element as a child, square sizing,
    `aria-label` requirement for icon-only buttons since there's no visible text) — it is
    not starting from a blank file.
  - This is deliberately the *only* component built in this ticket; the rest of #15's
    scope (text input, textarea, checkbox, select) and the other already-tracked issues
    (Input, DatePicker, Tags, layout primitives) are untouched here.
- Test: renders each variant/size combination, asserts the button text renders, asserts
  `disabled` is respected, asserts `onClick` fires. Not asserting exact Tailwind class
  strings (brittle, low value) — asserting behavior/content instead.

### 3.4 Demo route

- New file `apps/web/src/routes/ui-demo-page.tsx`, exporting `UiDemoPage`, which renders
  a heading per component (starting with just "Button") and, under each, every
  variant/size combination with a visible label, so it's scannable during dev.
- Register it in `apps/web/src/router.ts` as a child of `rootRoute` at path `/dev/ui`
  (chosen over something like `/ui` or `/components` to read unambiguously as a
  dev-only tool, not a real app route, if someone stumbles on it later).
- Registration is gated behind `import.meta.env.DEV`: the route is only added to the
  route tree when running the dev server, so it doesn't appear in the production route
  tree or get linked from production UI. Vite statically replaces `import.meta.env.DEV`
  at build time, so Rollup can dead-code-eliminate the branch in production builds.
  Decision, not left ambiguous: this is a dev-only tool per the issue's own wording
  ("for visual review during development"), so keeping it out of prod is the more
  correct default; nothing in the issue asks for it to be reachable in production.
- Discoverability: add a small dev-only text link to `/dev/ui` in `RootRoute`, also
  gated on `import.meta.env.DEV`, so a developer running `npm run dev` can find it
  without needing to already know the URL. (Direct navigation to the URL always works
  regardless; the link is just a convenience.)
- Test: `apps/web/src/routes/ui-demo-page.test.tsx` renders `UiDemoPage` directly (no
  router needed, it's a plain component) and asserts each Button variant/size renders
  with its label — i.e., asserts the demo route actually shows what it claims to show.

### 3.5 Files touched/created (summary)

New:
- `apps/web/src/index.css`
- `apps/web/src/components/ui/README.md`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/button.test.tsx`
- `apps/web/src/routes/ui-demo-page.tsx`
- `apps/web/src/routes/ui-demo-page.test.tsx`

Modified:
- `apps/web/package.json` (+ `tailwindcss`, `+@tailwindcss/vite`)
- `package-lock.json` (via `npm install`)
- `apps/web/vite.config.ts` (+ Tailwind Vite plugin)
- `apps/web/src/main.tsx` (+ CSS import)
- `apps/web/src/router.ts` (+ demo route, dev-gated)
- `apps/web/src/routes/root-route.tsx` (+ dev-only link to demo route)

Not touched:
- `apps/web/vitest.config.ts` — see §2 for why (tests don't import `index.css`, so the
  Tailwind Vite plugin isn't needed there).

No database/Prisma schema changes — this is frontend-only infra.

## 4. Explicitly out of scope (scope boundary)

- **Building out the rest of the real component library** (text input, textarea,
  checkbox, select, DatePicker/date-time picker, Tags, layout primitives, etc.). The
  issue lists these as separate, already-tracked issues (primarily #15) that this one
  unblocks — building them here would be scope creep on a ticket explicitly described as
  "foundational."
- **`Button`'s `icon` variant.** Explicitly and deliberately deferred to #15, which lists
  it as part of its own scope. This ticket's `Button` covers only `primary`/`secondary`
  (what's needed to prove the Tailwind/demo-route chain works) and, per §3.3, is meant to
  be *extended* by #15 with the `icon` variant — not rebuilt. This is the one place
  where this ticket and a dependent ticket's stated scope literally overlap on the same
  file, so it's called out here explicitly rather than left for #15's implementer to
  discover and guess about.
- **Storybook.** Explicitly deferred per the issue and AGENT_RULES.md — the demo route
  is the intentional lightweight substitute for this ticket's timeframe.
- **Custom Tailwind theme** (brand colors, spacing scale, typography scale, radii).
  AGENT_RULES.md is explicit that theme customization lands incrementally with the
  component/feature tickets that need it, not as a big upfront theming pass. This ticket
  only installs Tailwind with its default theme.
- **Auto-discovery of components for the demo route** (e.g. `import.meta.glob` scanning
  `components/ui/` and rendering whatever it finds). Considered and rejected for this
  ticket: it would remove the manual "add it to the demo page" step, but requires
  standardizing how a component declares its variants/props for generic rendering,
  which is a design decision better made once there's more than one real component to
  generalize from. Manual registration + the README convention is simpler and
  transparent for review right now; revisit if the manual step becomes a repeated
  friction point across future component tickets.
- **Enforcing the `components/ui/` convention mechanically** (custom ESLint rule, CI
  check that new component files land in the right directory). Not requested by the
  issue; a README + code review is enough at this stage.
- **Dark mode / theme switching, accessibility audit tooling.** Not mentioned in the
  issue; would be speculative scope.
- **Any actual app feature.** This ticket touches no server code, no tRPC procedures,
  no `TasksPage` behavior.

## 5. Edge cases / error conditions to cover in tests

- `Button`: each `variant` × `size` combination renders without throwing; `disabled`
  prop actually disables the native button (and, ideally, that `onClick` doesn't fire
  when disabled — jsdom/native button behavior should already prevent this, but worth
  asserting since it's cheap); `onClick` fires exactly once per click; default props
  (`variant`/`size` omitted) render the documented defaults.
- `UiDemoPage`: renders without a router/query/tRPC context (it must not depend on any
  of those — it's a static showcase), and every declared variant/size combination is
  present with a distinguishing label in the rendered output (so a future component
  added here without updating labels would be caught by a failing assertion, not just
  visually).
- Production build sanity: `npm run build -w apps/web` must succeed and must not include
  `/dev/ui` in the route tree available at runtime in a production bundle — this is a
  manual/CI-level check (the existing `build` CI step already exercises this path), not
  something to write a dedicated automated test for, since asserting on bundle contents
  is disproportionate for this ticket's size. Flagging here so `reviewer-tests` doesn't
  expect a bundle-inspection test that isn't planned.
- Tailwind wiring: no dedicated unit test for "Tailwind CSS actually applies" (that's a
  visual/manual check via the demo route, consistent with the issue's own framing of the
  demo route as "for visual review") — but the `Button` test suite indirectly proves the
  component renders with the classes applied without erroring, and CI's existing `build`
  step proves the CSS pipeline compiles.

## 6. Open questions

None blocking.

- The one real ambiguity around production reachability (should the demo route be
  reachable in production) is resolved above as a decision (dev-only, gated on
  `import.meta.env.DEV`) with reasoning, rather than left open, since the issue's own
  wording ("in-app demo route ... for visual review during development") is specific
  enough to decide from.
- The #14/#15 `Button` overlap (raised in review) is likewise resolved as a decision in
  §3.3/§4: this ticket's `Button` is the real, permanent component that #15 extends with
  an `icon` variant, not a throwaway artifact #15 replaces.
