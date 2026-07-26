# `components/ui/`

Generic, reusable, presentational components — buttons, inputs, the date-time picker,
tags, layout primitives, etc. Not feature/page components (those live under
`src/routes/`).

## Conventions

- **Filenames**: kebab-case (e.g. `button.tsx`).
- **Exports**: PascalCase named export matching the component (e.g. `button.tsx` exports
  `Button`). Matches the `src/routes/` convention already used in this repo.
- **Tests**: every component gets a colocated `*.test.tsx` (e.g. `button.test.tsx`),
  Vitest + Testing Library, matching the pattern in `src/routes/tasks-page.test.tsx`.
- **Styling**: Tailwind utility classes, default theme. No custom theme tokens yet —
  extend `@theme` in `src/index.css` only when a component/feature ticket actually needs
  it (see `AGENT_RULES.md`), not speculatively.
- **Demo route**: every component here must be added to the demo page
  (`src/routes/ui-demo-page.tsx`) so it stays visible for visual review at `/dev/ui`
  (dev server only). This is manual registration, not auto-discovery — when you add a
  new component, add a section for it in `ui-demo-page.tsx` showing its variants/sizes.

## Extending an existing component vs. adding a new one

If a later ticket needs a new variant of a component that already exists here (e.g. an
`icon` variant of `Button`), extend the existing file in place — don't create a
duplicate or rebuild it from scratch. See the note at the top of `button.tsx` for a
concrete example.
