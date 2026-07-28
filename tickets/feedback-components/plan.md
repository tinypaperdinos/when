# Plan: Component library: feedback components (Modal/Dialog, Empty state, Loading state)

Issue #19's full text:

> Modal/dialog (for create/edit task forms), empty state, and loading state
> components — currently these exist only as ad-hoc inline JSX in tasks-page.tsx from
> the scaffold ticket; this generalizes them into reusable components.
>
> Depends on: Component library setup.

Like the other component-library tickets (#16 date-time-picker, #17/#36 tag-input-badge),
this names three goals without specifying props/visual spec/exact shape. This plan makes
those calls explicit.

## 0. Open question / ambiguity flagged up front

The issue's phrasing reads as if all three components currently exist as ad-hoc JSX in
`tasks-page.tsx`. Checking `apps/web/src/routes/tasks-page.tsx` as it stands today:

```tsx
{isLoading && <p>Loading tasks…</p>}
{isError && <p>Something went wrong loading tasks.</p>}
{!isLoading && !isError && (!data || data.length === 0) && <p>No tasks yet</p>}
```

Loading and empty states really are there, as plain `<p>` tags. **There is no ad-hoc
modal JSX anywhere in the codebase.** Task editing (`task-list-item.tsx`) is an
inline in-place edit form (`isEditing` state swaps the list item's own JSX), not a
dialog. There's no existing modal call site to "generalize."

Interpretation adopted here (not silently assumed — flagging it): build `Modal` as a
net-new, generic, reusable primitive — registered in the demo route like every other
`components/ui/` addition — but **don't** rewire `task-list-item.tsx`'s inline edit (or
`task-create-form.tsx`) to use it. Reasons, and precedent, in §5 (scope boundaries).
Loading and empty state, by contrast, really do have an ad-hoc JSX target in
`tasks-page.tsx`, so those two get migrated as part of this ticket.

## 1. What "done" means

- Four new, generic, presentational components exist under `apps/web/src/components/ui/`:
  - `Spinner` — a small, purely decorative, reusable loading indicator (the 4-square
    phase-offset pulse from the `explore/page-design` reference branch, which
    `components/ui/README.md` explicitly says to pull from as tickets need it — this is
    the first ticket that needs it).
  - `LoadingState` — composes `Spinner` + a label into an accessible (`role="status"`,
    `aria-live="polite"`), centered block. This is the thing that actually replaces
    `<p>Loading tasks…</p>`.
  - `EmptyState` — icon/title/description/action slots, replaces `<p>No tasks yet</p>`.
  - `Modal` — a controlled (`isOpen`/`onClose`), portal-rendered, focus-trapping dialog
    with a required `title`, optional `description`, a built-in close button,
    backdrop-click-to-close and Escape-to-close (each independently toggleable), and
    background scroll lock while open. Panel is capped at `max-w-lg`/`max-h-[85vh]` with
    internal scroll for overflow, backdrop+panel both at `z-50` (this codebase's first
    overlay z-index, above `TagInput`'s `z-10` dropdown — see §2.4). Escape is a
    document-level listener (§2.5) and backdrop-click uses mousedown-tracked target
    resolution so a text-selection drag out of the panel can't spuriously close it (§2.5).
    Net new — see §0.
- Each has a colocated `*.test.tsx` (Vitest + Testing Library, `fireEvent`-only, matching
  every existing `components/ui/` test) covering the edge cases in §4.
- All four are registered in `src/routes/ui-demo-page.tsx` per
  `components/ui/README.md`'s convention, with `ui-demo-page.test.tsx` extended to cover
  the new sections (matching the interactive-demo-needs-`useState` precedent already set
  for `DateTimePicker`/`TagInput`, since `Modal` is controlled).
- `apps/web/src/routes/tasks-page.tsx` swaps its ad-hoc loading/empty `<p>` tags for
  `LoadingState`/`EmptyState`. The ad-hoc error `<p>` is deliberately left alone (§5).
- `apps/web/src/index.css` gains the one new theme addition this ticket needs: the
  `--animate-square-pulse` keyframe animation, ported from `explore/page-design`
  verbatim (comment already invites this — see `components/ui/README.md`'s "pull
  patterns from there" note).
- `components/ui/README.md` gets a short addition documenting `Modal`'s pattern (portal +
  focus trap), a third "shape" alongside the existing "thin native wrapper" and
  "composite controlled-value molecule" categories.
- No backend/schema/tRPC changes. No new npm dependency (`Modal`'s portal uses
  `react-dom`'s `createPortal`, already a direct dependency via `react-dom` — no
  headless-ui/Radix/etc.). CI (`lint`, `typecheck`, `test`, `build`) stays green.

Non-goals in full in §5.

## 2. Design decisions

### 2.1 `Spinner` + `LoadingState`: two components, not one

Mirrors the `Card`/`Panel` and `Badge`/`TagInput` precedent (`components/ui/README.md`):
a small, purely-visual primitive (`Spinner`) plus a composite that gives it an accessible
wrapper and a text label (`LoadingState`), rather than one component doing both jobs.
Reason: `Spinner` alone is independently useful in a tighter space later (e.g. inside a
`Button` while a mutation is pending — not built in this ticket, but worth not
foreclosing), where a full `role="status"` block with padding/label doesn't fit.

- `Spinner` is **always** `aria-hidden="true"` — purely decorative, never itself
  responsible for an accessible name/announcement.
- `LoadingState` is the accessible surface: `role="status"`, `aria-live="polite"`,
  wraps `Spinner` and a visible label (default `"Loading…"`) that doubles as the
  live-region's announced text — no separate visually-hidden text needed, the label is
  always rendered.
- Animation respects `prefers-reduced-motion`: each of the 4 squares gets Tailwind's
  built-in `motion-reduce:animate-none` (no new CSS media query needed — Tailwind v4
  ships this variant by default). The reference branch's original didn't handle this;
  adding it here since this is the first time the animation ships to real users.

```ts
// spinner.tsx
export type SpinnerSize = "sm" | "md";
export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> { size?: SpinnerSize; }
// renders 4 absolutely-positioned squares (bg-accent) inside a relative size-6/size-8
// container, animate-square-pulse + motion-reduce:animate-none, phase-offset via
// inline style={{ animationDelay }} exactly like the reference branch.

// loading-state.tsx
export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode; // default "Loading…"
  size?: SpinnerSize; // forwarded to Spinner, default "md"
}
// <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 py-8 text-sm text-ink/60">
//   <Spinner size={size} /><span>{label}</span>
// </div>
```

### 2.2 `EmptyState`: reuses `Panel`'s `aria-labelledby`/`role="region"` landmark pattern

`title` is **required** here (unlike `Panel`, where it's optional because `Panel` has
many non-empty-state uses) — an empty state without a headline message isn't a
meaningful empty state. Given `title` is always present, `EmptyState` can unconditionally
apply the same `useId` + `aria-labelledby` + `role="region"` pattern `Panel` already
established, rather than inventing a new landmark convention.

No new border/visual token: a plain centered block (icon above title, `text-ink/60`
description below, optional `action` slot below that — no border, no dashed-border
"well"). Introducing a new border language for "emptiness" isn't justified by one call
site and isn't asked for by the issue; `README.md`'s "extend only as needed" guidance
argues against it here.

```ts
export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: ReactNode; // required
  description?: ReactNode;
  action?: ReactNode; // e.g. a <Button>
}
```

`EmptyState` stays strictly presentational — no `isEmpty`/data prop, no knowledge of
*why* something is empty; the consumer still owns that condition (`tasks-page.tsx` keeps
its existing `!isLoading && !isError && (!data || data.length === 0)` check, same as
today, just rendering `<EmptyState title="No tasks yet" />` instead of a `<p>`). This
matches `Badge`'s explicit "stays strictly presentational" precedent (issue #17).
`tasks-page.tsx`'s usage passes no `action` — `TaskCreateForm` is already always rendered
above the list, so a redundant "+ new task" action inside the empty state isn't needed
for this call site (a future consumer with a different layout can still pass one).

### 2.3 `Modal`: hand-rolled `role="dialog"` + `createPortal`, not native `<dialog>`, not a new dependency

Two implementation choices considered for the dialog itself:

- **Native `<dialog>` + `.showModal()`/`.close()`.** Rejected: those are imperative DOM
  methods that fight a controlled `isOpen` prop (React would need an effect calling them
  anyway, gaining nothing over a plain `div`), and browser-default `::backdrop` styling
  doesn't fit this app's `bg-ink/50` overlay language without extra CSS surface area
  anyway.
- **Hand-rolled `<div role="dialog" aria-modal="true">` + manual focus trap + Escape
  listener + `createPortal(..., document.body)`.** Adopted — consistent with `TagInput`'s
  already-established precedent of hand-rolling ARIA widget behavior rather than reaching
  for a library (`components/ui/README.md`), and no new npm dependency.

`createPortal` into `document.body` (first use of it in this codebase, but `react-dom` is
already a direct dependency, so this is not a new dependency) rather than rendering
in-place: `position: fixed` would look identical *today* since nothing currently wraps
`Modal`'s call sites in an `overflow`/`transform` ancestor, but that's incidental and
fragile — a future `Card`/`Panel` wrapper with `overflow-hidden` would silently clip a
non-portaled modal. Using a portal is the standard fix and costs nothing extra to test:
Testing Library's `screen` queries are bound to `document.body` by default, so portaled
content is found by `screen.getByRole(...)` exactly like anything else — no special test
setup, worth stating explicitly so `reviewer-tests` doesn't flag it as a gap.

`title` is **required** (not optional like `Panel`'s) — a dialog that interrupts the
whole page needs an accessible name essentially always; making it required removes an
"omitted `title`, did the consumer forget `aria-label`?" edge case entirely rather than
handling it. Deliberate deviation from `Panel`'s precedent, called out so it doesn't read
as an oversight.

```ts
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode; // required — see above
  description?: ReactNode;
  children: ReactNode;
  className?: string; // applied to the dialog panel, not the backdrop
  closeOnBackdropClick?: boolean; // default true
  closeOnEscape?: boolean; // default true
  initialFocusRef?: RefObject<HTMLElement | null>; // see §2.6
}
```

Controlled-only, no `defaultOpen` escape hatch — but this isn't quite
`components/ui/README.md`'s existing "composite controlled-only value component"
category (`DateTimePicker`/`DateRangePicker`/`TagInput`, which is about reconciling a
`value`/`onChange` shape); `Modal`'s controlled-ness is about visibility, the standard
controlled-portal-dialog shape. The README addition in this ticket documents it as its
own, third category rather than folding it into that existing paragraph.

Rendering: `Modal` calls all its hooks unconditionally (rules-of-hooks), then does
`if (!isOpen) return null;` **after** the hooks — every effect below is written to no-op
internally when `isOpen` is `false` rather than being skipped via an early return before
the hooks run.

### 2.4 Visual/layout contract (backdrop + panel)

Flagged in round-2 review as under-specified: the plan was precise about focus/ARIA
mechanics but silent on the panel's own sizing and stacking, even though this is the
**first `createPortal`-rendered overlay in the codebase** — confirmed via
`grep -rn "createPortal|document.body" apps/web/src/components/ui/*.tsx` (no prior hits)
— so there's no existing convention to inherit. The only existing `z-*` precedent is
`TagInput`'s suggestion dropdown (`z-10`, `tag-input.tsx:174`). Making the contract
explicit here rather than leaving it for the implementer to invent:

- **`z-index`**: backdrop and panel both get **`z-50`** (Tailwind's built-in scale, no new
  token). Chosen specifically to sit above `TagInput`'s `z-10` dropdown — a realistic
  near-term scenario is a `TagInput` rendered *inside* a future form-in-`Modal` consumer,
  where the dropdown must still render above the modal's own panel background, which a
  same-stacking-context `z-50` on the portal root guarantees regardless of where in the
  tree the `TagInput` lives (portal content escapes ancestor stacking contexts other than
  a `z-index`d one). `50` is deliberately not `10`-adjacent (e.g. `z-20`) so a *future*
  second overlay layer (toast, nested modal — both non-goals here, §5) has headroom
  without needing to renumber `Modal`'s value later. Documented in the README addition
  (§3) as this codebase's first "overlay" z-index precedent so later tickets don't
  reinvent it ad hoc.
- **Backdrop**: `fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4` — the
  `p-4` is load-bearing, not decorative: it guarantees breathing room around the panel on
  narrow viewports (see responsive width below) so the panel is never flush against the
  screen edge.
- **Panel**: `w-full max-w-lg max-h-[85vh] overflow-y-auto` layered onto `Panel`'s
  existing `baseClasses` (`rounded-sm border-2 border-ink bg-paper shadow-hard`) plus
  `p-6` — i.e. visually a `Panel` (reusing the exact same token language, not inventing a
  new one), sized so it never exceeds 85% of the viewport height. Content taller than
  that scrolls internally rather than clipping the close button off-screen or pushing it
  below the fold — this directly answers the review's "several-field form (title, notes,
  `DateTimePicker`, `TagInput`) could exceed viewport height" scenario, since `Modal` is
  explicitly meant to support that kind of consumer later even though this ticket doesn't
  wire one up (§5).
- **Responsive width**: no `sm:`/`md:`/`lg:` breakpoint prefixes — confirmed via
  `grep -rln "sm:\|md:\|lg:\|xl:"` across `apps/web/src` that **no component in this
  codebase uses Tailwind responsive breakpoint prefixes today**, so introducing the
  app's first one, unprompted, inside a component-library ticket isn't justified. Instead,
  `w-full max-w-lg` (fluid up to a cap) combined with the backdrop's `p-4` viewport gutter
  is the existing idiom this codebase already uses elsewhere for width-that-adapts (see
  `Card`/`Panel`, which are never given a fixed width and just fill whatever container
  they're placed in) — narrow-viewport behavior is "full available width minus the
  backdrop's padding," wide-viewport behavior is "capped at `max-w-lg` (32rem), centered."
  `className` (in `ModalProps`) can override `max-w-lg` per-consumer if a future wider
  form needs it; not exercised by this ticket's own demo/tests, called out as available.
- Testability note for `reviewer-tests`: jsdom has no layout engine, so "content taller
  than 85vh actually scrolls instead of clipping" isn't meaningfully assertable via
  Testing Library (no real computed heights). The test-level proxy is asserting the panel
  element's `className` contains `max-h-[85vh]` and `overflow-y-auto` (and the backdrop's
  contains `z-50`) — a class-presence check, not a rendered-behavior check. Genuine visual
  verification of the scroll behavior is a manual/visual-QA concern, stated here so its
  absence from the automated suite isn't read as a coverage gap.

### 2.5 Escape and backdrop-click interaction handling

Both flagged in round-2 review as stated too loosely to be a correctness guarantee (they
were previously folded into §2.3's prose); broken out into their own subsection and made
explicit:

- **Escape listener is attached to `document`, not the panel node.** A `useEffect` keyed
  on `isOpen` adds a `keydown` listener to `document` when `isOpen` becomes `true`
  (checking `event.key === "Escape"` and `closeOnEscape` before calling `onClose`) and
  removes it in the cleanup. This is deliberate, not incidental:
  §2.6 moves initial focus into the panel via a *separate* effect, and effects on the same
  render don't all run "simultaneously" — there's a real window between mount/open and
  that focus-effect completing where `document.activeElement` is still the external
  trigger element. A panel-scoped `keydown` handler (relying on bubbling from whatever
  currently has focus) would silently miss `Escape` presses in that window, since the
  event wouldn't yet be bubbling up through the panel's subtree. A `document`-level
  listener has no such dependency on where focus currently is, which is the standard,
  safe choice for hand-rolled dialogs and removes the timing hazard entirely. Test
  implication: the `Escape`-closes test dispatches `fireEvent.keyDown(document, { key:
  "Escape" })` (not `fireEvent.keyDown(panelElement, ...)`), which also happens to be the
  only form of the test that would actually catch a regression to a panel-scoped
  listener.
- **Backdrop click uses mousedown-tracked target, not raw `click`-target alone.** The
  previous plan's `event.target === event.currentTarget` check on `onClick` alone is
  insufficient: a `click` event's `target` is resolved from where `mouseup` fires, not
  `mousedown` — so a user starting a text-selection drag *inside* the panel (a long
  `description`, or once a real form is wired in later) and releasing the mouse button
  past the panel's edge fires a `click` whose `target` is the backdrop, which would
  incorrectly close the modal mid-interaction. Fix, matching this codebase's own existing
  precedent for hand-rolling around exactly this class of pointer-event nuance
  (`tag-input.tsx`'s `onMouseDown={(e) => e.preventDefault()}`, commented at
  `tag-input.tsx:189`, exists specifically to suppress a different mousedown-driven side
  effect race — same general principle of not trusting a single event type in isolation
  for this kind of interaction): the backdrop gets **both** an `onMouseDown` and an
  `onClick` handler. `onMouseDown` records, in a `ref` (not state — no re-render needed),
  whether *that* mousedown's `event.target === event.currentTarget`. `onClick` only calls
  `onClose` when `closeOnBackdropClick` is true **and** the click's own
  `event.target === event.currentTarget` **and** the ref recorded from the most recent
  `mousedown` was also `true`. A drag that starts inside the panel (mousedown target =
  panel descendant, ref recorded `false`) and ends on the backdrop (click target =
  backdrop) is correctly rejected, since the ref check fails even though the click-target
  check alone would have passed. No `stopPropagation()` anywhere in the component — the
  fix is entirely mousedown/click cross-referencing, not event suppression.

### 2.6 Focus management specifics

- **Initial focus on open**: `initialFocusRef?.current`, else the first focusable
  descendant of the panel (computed live via `querySelectorAll` over the standard
  focusable-selector list — `a[href], button:not([disabled]), textarea:not([disabled]),
  input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])` — not
  cached once, since modal body content can itself change, e.g. a form with a
  conditionally-rendered field). `Modal` always renders its own close button in the
  header, so there's always at least one focusable descendant in practice; the panel
  additionally gets `tabIndex={-1}` as a defensive fallback (not expected to trigger,
  cheap to keep).
- **Header DOM order is title-then-close-button**, so by default (no `initialFocusRef`)
  the close button receives initial focus, since it's first in DOM order. This is a
  deliberate, documented default (common modal behavior: land on the "exit" affordance
  unless told otherwise) — a consumer wanting a specific field focused instead (e.g. a
  future create-task modal wanting its title input focused) passes `initialFocusRef`
  pointing at that field. Flagging this so it doesn't read as an accidental UX choice.
- **Focus trap**: a `keydown` listener on the panel handles `Tab`/`Shift+Tab`, recomputing
  first/last focusable descendants on every keypress (same live-query reasoning as
  above): if `Shift+Tab` and `document.activeElement` is the first focusable element (or
  outside the panel entirely), `preventDefault()` + focus the last; if `Tab` (no shift)
  and `activeElement` is the last, `preventDefault()` + focus the first. This is fully
  driven by our own handler calling `.focus()` explicitly — unlike `TagInput`'s
  mousedown/blur caveat (`tag-input.tsx`'s comment on why that one specific interaction
  can't be asserted via `fireEvent` in jsdom), this trap doesn't depend on the browser's
  native Tab-key focus movement at all, so `fireEvent.keyDown(el, { key: "Tab" })` +
  asserting `document.activeElement` afterward is a direct, reliable test — no jsdom
  limitation here, worth noting so `reviewer-tests` doesn't assume one exists by analogy.
- **Restore focus on close**: an effect captures `document.activeElement` the moment
  `isOpen` becomes `true` (before moving focus into the dialog); its cleanup (fires when
  `isOpen` flips back to `false`, or the component unmounts while still open — same
  cleanup function covers both) calls `.focus()` on the captured element, guarded by
  `document.contains(el)` first. Edge case worth calling out explicitly: if whatever
  triggered the modal (e.g. a list item's "Edit" button) was itself removed from the DOM
  while the modal was open (its underlying task got deleted concurrently), the guard is a
  clean explicit no-op rather than relying on `.focus()` on a detached node silently
  doing nothing.
- **Background scroll lock**: an effect sets `document.body.style.overflow = "hidden"`
  while `isOpen`; its cleanup restores the *previously captured* inline value (not a
  hardcoded `""`), in case something else already had an opinion on `body`'s overflow.

## 3. Task breakdown

### New files
- `apps/web/src/components/ui/spinner.tsx` + `spinner.test.tsx`
- `apps/web/src/components/ui/loading-state.tsx` + `loading-state.test.tsx`
- `apps/web/src/components/ui/empty-state.tsx` + `empty-state.test.tsx`
- `apps/web/src/components/ui/modal.tsx` + `modal.test.tsx`

### Modified files
- `apps/web/src/index.css` — add `--animate-square-pulse` + `@keyframes square-pulse`
  (ported from `explore/page-design`'s `index.css`, `@theme`/`@layer` blocks already
  established).
- `apps/web/src/components/ui/README.md` — add the 4 components to whatever
  listing/prose exists, plus the short "Modal: portal + focus trap" paragraph (§2.3–2.6
  above condensed, including the z-index/visual-contract note from §2.4 so it is
  discoverable without reading this plan).
- `apps/web/src/routes/ui-demo-page.tsx` — new sections: `Spinner` (sm/md side by side),
  `LoadingState` (default label + custom label), `EmptyState` (with and without
  icon/action), `Modal` (a trigger `Button` + local `useState<boolean>`, demonstrating
  title/description/children/close button — mirrors the existing
  `DateTimePicker`/`TagInput` demo pattern of needing local state since these are
  controlled).
- `apps/web/src/routes/ui-demo-page.test.tsx` — cover the new sections, including
  actually opening/closing the `Modal` demo (click trigger → dialog visible; Escape or
  close button → dialog gone), matching the existing "genuinely interactive" bar already
  set for the `DateTimePicker`/`TagInput` demo tests.
- `apps/web/src/routes/tasks-page.tsx` — replace the loading `<p>` with `<LoadingState
  label="Loading tasks…" />` and the empty `<p>` with `<EmptyState title="No tasks
  yet" />`. The error `<p>` is untouched (§5).
- `apps/web/src/routes/tasks-page.test.tsx` — existing assertions (`/loading tasks/i`,
  `/no tasks yet/i`) keep passing unchanged since both new components still render that
  exact visible text; no required changes. Optionally strengthen with a `role="status"`
  assertion on the loading case, not required for "done."

### No changes
- No `apps/server` changes, no Prisma schema changes, no tRPC router changes — pure
  frontend/presentational ticket, same shape as every prior component-library ticket.
- No changes to `task-create-form.tsx`/`task-list-item.tsx` (§0, §5).

## 4. Edge cases and error conditions to cover in tests

**`Spinner`**
- `size` sm vs md renders distinct dimensions (matches `Button`/`TextInput`'s existing
  size-variant test pattern).
- Always `aria-hidden="true"`, regardless of size/className.

**`LoadingState`**
- Default label ("Loading…") renders when `label` omitted; custom `label` overrides it.
- Root element has `role="status"` and `aria-live="polite"`.

**`EmptyState`**
- Renders with only the required `title` (no icon/description/action).
- Renders icon/description/action when supplied; `action` (e.g. a `Button`) is
  interactive/clickable as normal.
- `role="region"` + `aria-labelledby` points at the rendered title, mirroring `Panel`'s
  existing test coverage for the same pattern.

**`Modal`**
- Renders nothing (`null`) when `isOpen={false}` — no dialog in the DOM at all, not just
  visually hidden.
- When `isOpen={true}`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` resolving
  to the rendered title text, `aria-describedby` present only when `description` is
  supplied.
- Backdrop click (`mousedown` **and** `click` both landing directly on the overlay
  element, not bubbled from the panel) calls `onClose`; a click that originates and ends
  inside the panel does **not** — see §2.5.
- **Drag-to-select regression case (§2.5)**: `mousedown` inside the panel followed by a
  `click` event whose `target` is the backdrop (simulating a text-selection drag that
  starts inside the panel and releases past its edge) does **not** call `onClose` — this
  is the specific case the mousedown-tracking ref fix exists for; a naive
  `event.target === event.currentTarget`-on-`click`-alone implementation would fail this
  test.
- Backdrop click is a no-op when `closeOnBackdropClick={false}` (both the direct-backdrop
  case and, trivially, the drag case).
- `Escape` key calls `onClose`, dispatched via `fireEvent.keyDown(document, ...)` (not the
  panel node) — §2.5's document-level-attachment decision is directly what this test form
  confirms, and would catch a regression to a panel-scoped listener. No-op when
  `closeOnEscape={false}`.
- The built-in close button calls `onClose`.
- Backdrop element carries `z-50`; panel element carries `max-w-lg`, `max-h-[85vh]`, and
  `overflow-y-auto` in its `className` — class-presence assertions, per §2.4's testability
  note (jsdom has no layout engine, so this is the closest automatable proxy for the
  visual contract; real overflow/scroll rendering is a manual-QA concern, not gapped test
  coverage).
- Initial focus lands on the first focusable descendant (the close button, by default
  DOM order — §2.6) when `isOpen` becomes `true`; lands on `initialFocusRef.current`
  instead when supplied.
- `Tab` from the last focusable descendant wraps focus to the first; `Shift+Tab` from the
  first wraps to the last (asserted via `document.activeElement`, not native browser tab
  behavior — see §2.6's note on why this one *is* directly testable with `fireEvent`).
- Focus returns to the previously-focused element once `isOpen` flips back to `false`
  (rerender test: render with a trigger button focused, open, close, assert focus is back
  on the trigger).
- Focus-restore is a no-op (doesn't throw) if the previously-focused element is no longer
  in the DOM when the modal closes.
- `document.body.style.overflow` is `"hidden"` while open, and restored to its prior
  value after close/unmount — including the "unmounts while still open" path (parent
  stops rendering `isOpen={true}` abruptly), covered via the same cleanup path, not a
  separate code branch.
- Rendered content is reachable via `document.body`-scoped `screen` queries even though
  the component is invoked from elsewhere in the tree (confirms the portal actually
  works, not just that it compiles).

**`tasks-page.tsx` migration**
- Existing `TasksPage` tests (loading / populated / empty / error) all still pass with
  the new components swapped in — this is a regression check, not new coverage, but
  worth explicitly re-running since it's the one place this ticket touches
  already-tested behavior.

## 5. Deliberately out of scope (scope boundaries)

- **Not wiring `Modal` into `task-create-form.tsx` or `task-list-item.tsx`'s inline edit
  flow.** Per §0, there's no existing ad-hoc modal JSX to migrate, and switching task
  create/edit from the current inline-form/inline-edit UX to a dialog is a real product
  decision with its own test-coverage surface on already-shipped, already-tested
  behavior (`task-crud` ticket) — not something to fold into a component-library ticket.
  This also matches this repo's own precedent: `DateTimePicker`/`TagInput` were built and
  demo'd by their own component-library tickets, then wired into real forms only by the
  *later* feature tickets that needed them (`task-crud`, `tags`), not by the component
  ticket itself.
- **No generic `ErrorState`/alert component.** The issue names Modal/Dialog, Empty state,
  and Loading state only — not an error state. `tasks-page.tsx`'s ad-hoc error `<p>` is
  left as-is; a future ticket can generalize it if/when it's actually named.
- **No nested/stacked modal support.** Only a single `Modal` instance open at a time is
  supported and tested — z-index stacking, Escape/backdrop ownership between two open
  modals, and focus restoration through two layers are real added complexity with zero
  current consumers.
- **No open/close transition animation on `Modal` itself** — it's an instant show/hide.
  An exit animation needs the component to stay mounted through the animation before
  actually unmounting, which is real state-machinery no consumer currently needs; the
  `Spinner`'s pulse is the one animation this ticket ports from the reference branch, and
  it's already-designed/precedented, unlike a modal transition which isn't.
- **No toast/snackbar-style transient notification.** Different concern from anything
  named in this issue.
- **No new npm dependency** (no headless-ui/Radix/similar dialog library) — hand-rolled,
  consistent with `TagInput`'s precedent and every other component-library ticket so far.
- **No backend/tRPC/schema changes** — pure frontend/presentational ticket.
