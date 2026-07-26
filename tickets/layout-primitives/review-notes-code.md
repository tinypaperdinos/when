# Review notes — code (layout-primitives, issue #18)

## reviewer-code — round 1

Reviewed `git diff origin/main...feat/layout-primitives` (single commit `175a553`)
against `ticket.md`/`gh issue view 18`, `plan.md`, and `refiner-notes.md`'s two
resolved rounds (Card/Panel split, heading levels, ARIA region roles, the
`title`-vs-`HTMLAttributes` `Omit` fix, and the explicit non-goals in §5). Ran the
actual commands, not just read the diff: `npm run --workspace apps/web lint`,
`typecheck`, `test`, and `build` all pass clean on this branch (47 tests / 6 files
passing, `tsc -b` clean, `vite build` succeeds, zero ESLint errors).

### Scope fidelity vs. ticket.md / plan.md

- Three new components (`Section`, `Card`, `Panel`) under `components/ui/`, each with a
  colocated test file, each registered in `ui-demo-page.tsx` with `ui-demo-page.test.tsx`
  extended — matches plan §1/§3 exactly.
- No unrequested scope: no real-page adoption (`TasksPage` untouched), no `interactive`
  Card prop, no `as`/polymorphic prop, no shared base-class extraction, no new
  dependency, no theme/`index.css`/`README.md` change, no backend touch — verified via
  `git diff --name-status`, only the 6 new files + the 2 demo-route files changed.
- The `title?: ReactNode` vs. native `HTMLAttributes.title` collision is fixed exactly
  as refiner-notes round 2 verified: `Omit<HTMLAttributes<HTMLElement>, "title">` on
  `SectionProps` (`section.tsx:3`) and `Omit<HTMLAttributes<HTMLDivElement>, "title">` on
  `PanelProps` (`panel.tsx:5`). Confirmed via the actual `tsc -b` run above (not just
  reading the plan's prior verification) — clean, zero errors.

### Correctness

- `Section` (`section.tsx`): header row renders only when `title || actions` is truthy
  (`hasHeader`), `aria-labelledby` set only when `title` is given, `useId()` heading id
  wired to both the `<section>` and the `<h2 id=...>` — matches plan §3.1/§2.4 exactly.
  `children` render directly after the header row with no extra wrapper, matching the
  "no imposed internal layout" requirement.
- `Card` (`card.tsx`): `sm`/`md` padding map to `p-3`/`p-4`, default `md`, no `title`
  prop, no landmark role, no interactive variant — matches §3.2/§5 exactly.
- `Panel` (`panel.tsx`): all four `title`/`description` combinations render the header
  block only when at least one is present; `role="region"` + `aria-labelledby` set only
  when `title` is present (not for `description`-only, matching the ARIA reasoning in
  §2.4 that a heading is required for the accessible name); `md`/`lg` padding →
  `p-4`/`p-6`, default `lg`. Matches §3.3 exactly, including the shared bordered-box
  base-class string being literally duplicated from `Card` rather than extracted (per
  §5's explicit non-goal).
- Demo route (`ui-demo-page.tsx`): Section block shows titled+actions (with `Card`
  children) and untitled variants; Card block shows both paddings with `sm:`/`md:`
  labels matching the existing `variant / size:` label convention used for `Button`;
  Panel block shows title+description, title-only, and neither, with `md`/`lg` padding
  demonstrated. Matches plan §3.4 point-for-point.
- Edge cases from plan §4 (zero-children/no-props render for all three, `className`
  merge, native prop forwarding via spread, region-role presence/absence) are all
  present in the three test files and pass.

No logic errors, race conditions, or off-by-ones found. No accidental omission of a
`Card`/`Panel` case from the four-combination matrix.

### Design

- Class composition (`baseClasses` constant + `Record<Variant, string>` maps +
  `[base, variant, className].filter(Boolean).join(" ")`) matches `button.tsx`'s
  established pattern exactly, no `clsx`/`tailwind-merge` introduced.
- `Section`/`Panel`/`Card` follow the same "spread `...props` after the computed
  `className`/`aria-*`/`role` attributes" ordering `Button` uses, which lets a caller's
  own `aria-labelledby`/`role` (if ever passed) win over the computed default — a
  reasonable, unforced escape hatch, not a bug.
- Heading levels (`<h2>` on `Section`, `<h3>` on `Panel`) and the `text-lg font-medium`
  class match plan §2.3/§2.1 exactly, addressing the refiner's round-1 concern about
  Tailwind preflight making unstyled headings visually inert.

### Simplification

Nothing to simplify further — the implementation is about as small as the plan's own
spec allows, and the plan already pre-empted the obvious simplification temptations
(shared base class, single Card/Panel component, `clsx`) with explicit reasoning in §5.

### Findings

No blocking findings. No non-blocking findings worth recording either — the diff is a
faithful, minimal implementation of an already twice-refined plan, and all CI-equivalent
commands (lint/typecheck/test/build) pass when actually run against this branch.

VERDICT: APPROVED
