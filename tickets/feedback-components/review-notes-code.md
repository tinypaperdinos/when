# Review notes: feedback-components (reviewer-code)

## reviewer-code — round 1

### Verification performed
- Read `ticket.md` (pointer to issue #19) and `plan.md` in full, including both refine
  rounds' resolved gaps (visual/layout contract, Escape attachment point, backdrop
  drag-to-select fix) in `refiner-notes.md`.
- Read the full diff (`git diff main...feat/feedback-components`): `spinner.tsx`,
  `loading-state.tsx`, `empty-state.tsx`, `modal.tsx` + all four `*.test.tsx`, the
  `index.css` keyframe addition, `README.md` addition, `tasks-page.tsx` migration, and
  `ui-demo-page.tsx`/`.test.tsx` additions.
- Ran `npm run lint --workspace=apps/web` — clean.
- Ran `npm run typecheck --workspace=apps/web` — clean.
- Ran `npm run test --workspace=apps/web -- --run` — 236/236 passed (23 files), including
  all new `modal.test.tsx`/`spinner.test.tsx`/`loading-state.test.tsx`/
  `empty-state.test.tsx` and the extended `ui-demo-page.test.tsx`. Existing
  `tasks-page.test.tsx` assertions (loading/populated/empty/error) still pass unchanged,
  confirming the `<p>` → `LoadingState`/`EmptyState` swap is a true regression-safe
  migration.
- Ran `npm run build --workspace=apps/web` — clean production build.
- Cross-checked the `Spinner`/keyframe port against `explore/page-design` directly
  (`git show explore/page-design:apps/web/src/index.css` and `design-explore-page.tsx`):
  the `--animate-square-pulse` keyframe, delays (`0ms/-300ms/-600ms/-900ms`), and corner
  positions are ported verbatim, with `motion-reduce:animate-none` correctly added on top
  as the plan specifies (the reference branch didn't have it).
- Confirmed no changes to `apps/server`, Prisma schema, or `task-create-form.tsx`/
  `task-list-item.tsx` — matches plan §5's stated non-goals.
- Confirmed `Button`'s `variant="icon" size="sm"` (used for Modal's close button) resolves
  correctly against `button.tsx`'s `iconSizeClasses`.

### Scope fidelity vs. ticket.md / issue #19
Matches. The issue's premise that a modal exists "only as ad-hoc inline JSX" doesn't hold
(verified false by `plan-refiner` round 1 and independently re-confirmed here: no
`role="dialog"`-shaped or modal-like JSX anywhere in `tasks-page.tsx`/`task-list-item.tsx`
pre-diff) — building `Modal` as a net-new primitive without wiring it into
`task-create-form.tsx`/inline task editing is the correct, precedented call (matches how
`DateTimePicker`/`TagInput` shipped in their own component-library tickets and were wired
into forms only by later feature tickets). Loading/empty state genuinely did migrate
existing ad-hoc `<p>` tags in `tasks-page.tsx`, as the issue describes. No unrequested
scope: no `ErrorState`, no toast, no nested-modal support, no new npm dependency — all
correctly left out per plan §5.

### Correctness
No bugs found. Specifically verified against the plan's own edge-case list (§4) and the
two refine-round fixes:
- **Escape**: document-level `keydown` listener (not panel-scoped), added/removed via
  effect cleanup keyed on `isOpen`/`closeOnEscape`/`onClose` — matches §2.5's stated
  reasoning about the timing window before the focus-move effect completes. Test asserts
  `fireEvent.keyDown(document, ...)`, the form that would actually catch a regression to a
  panel-scoped listener.
- **Backdrop drag-to-select fix**: `onMouseDown` records `event.target ===
  event.currentTarget` into a ref; `onClick` only fires `onClose` when both the click's own
  target check *and* the ref from the immediately-preceding mousedown agree. Walked through
  the drag-starts-in-panel/ends-on-backdrop case by hand against the code — correctly
  rejected. The dedicated regression test (`modal.test.tsx:127`) exercises exactly this.
- **Focus trap**: live-queried focusable descendants (not cached), `Tab`/`Shift+Tab`
  wrap-around fully driven by explicit `.focus()` calls (not relying on jsdom's
  nonexistent native tab-focus movement) — correctly reasoned and testable, matches §2.6.
- **Focus restore**: `document.activeElement` captured inside the same effect that moves
  focus, before moving it; cleanup calls `.focus()` guarded by `document.contains(el)` for
  the "trigger removed from DOM while modal was open" edge case — both paths (isOpen→false
  and unmount-while-open) go through the same cleanup function, verified via the two
  dedicated tests (`modal.test.tsx:268`, `:283`, `:317`).
- **Scroll lock**: captures and restores the *previous* inline `overflow` value (not a
  hardcoded `""`), verified by the two tests using different starting values (`""` and
  `"scroll"`).
- **Rules-of-hooks**: all three effects run unconditionally; `if (!isOpen) return null`
  comes after all hook calls — consistent with §2.3's stated constraint, no conditional
  hook calls anywhere in `modal.tsx`.
- `Spinner`'s `aria-hidden="true"` is applied after the `{...props}` spread, so a
  consumer-supplied `aria-hidden` prop can't override the always-hidden invariant — matches
  the dedicated test at `spinner.test.tsx:38`.
- `EmptyState`/`LoadingState` correctly reuse `Panel`'s `role`/`aria-labelledby`/`useId`
  landmark pattern; `title` is required on both `EmptyState` and `Modal` per §2.2/§2.3.

### Design
Fits existing conventions well: `cn()` utility, `Panel`'s `baseClasses` token language
reused (not literally imported since `Panel` doesn't export the constant, but the class
list is copied faithfully — `rounded-sm border-2 border-ink bg-paper shadow-hard` matches
`panel.tsx:12` verbatim), `Button`'s `icon` variant reused for the close button rather than
a bespoke button, README addition documents the new "portal + focus-trap" component shape
as its own category rather than overloading the existing two. `z-50` on both backdrop and
panel (redundant given the panel is a DOM descendant of the backdrop's own stacking
context) was already flagged as harmless/non-blocking by `plan-refiner` round 2 — not
re-flagging here.

### Simplification
Nothing to simplify — the hand-rolled dialog is about as lean as a correct, accessible,
portal-rendered, focus-trapping modal can be without pulling in a dependency, and the
plan's own non-goals (no nested modals, no transition animation) already trimmed scope
appropriately.

### Non-blocking notes
- `Panel`'s `baseClasses` constant (`panel.tsx:12`) isn't exported, so `Modal`'s panel
  className duplicates that literal string rather than importing it. Not a real
  maintenance risk today (one other call site), but if a third overlay-shaped component
  needs the same token set later, exporting `baseClasses` from `panel.tsx` would be worth
  doing then.

No blocking findings. Lint, typecheck, test, and build all pass locally; diff matches the
approved plan faithfully, including both refine-round fixes.

VERDICT: APPROVED
