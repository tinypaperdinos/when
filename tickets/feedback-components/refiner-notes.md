# Refiner notes: feedback-components

## Round 1

### Scope call on Modal wiring — verified sound, not a dodge

The planner's claim that there's no ad-hoc modal JSX in `tasks-page.tsx` checks out —
confirmed directly against `apps/web/src/routes/tasks-page.tsx` (only loading/empty/error
`<p>` tags) and `apps/web/src/routes/task-list-item.tsx` (inline `isEditing`-state edit
form, not a dialog). The issue's premise ("these exist only as ad-hoc inline JSX") is
simply wrong about the modal piece, and the plan's decision to build `Modal` as a net-new
primitive without rewiring `task-create-form.tsx`/`task-list-item.tsx` is the correct
call, not scope-dodging.

The "matches prior precedent" claim is also verified, not just asserted:
- `DateTimePicker` was built in `date-time-picker` ticket and wired into
  `task-create-form.tsx` only later, by `task-crud` (`660c425 Task CRUD (#31)`) —
  confirmed via `git log --follow` and grep for `DateTimePicker` usage.
- `TagInput`/`Badge` were built in `tag-input-badge` ticket and wired into task tag
  assignment only later, by the `tags` ticket (`53fa155 feat(tags): expose Tag relation
  via tRPC and wire task tag assignment`).

So deferring `Modal` wiring to a future feature ticket is consistent, real precedent, not
an invented excuse. Also checked: the issue names only Modal/Empty/Loading, not an error
state, so leaving `tasks-page.tsx`'s ad-hoc error `<p>` untouched is correctly scoped
(not under-scoped) rather than an oversight.

### Real gaps found

1. **No visual/layout contract specified for the `Modal` panel.** The plan is very
   precise about focus-trap/ARIA behavior (§2.4) but says nothing about the dialog
   panel's own sizing: no `max-width`, no `max-height` + `overflow-y-auto` for content
   taller than the viewport, no responsive width behavior on narrow screens, and no
   explicit `z-index` value. This matters because:
   - This is the first `createPortal`-rendered overlay in the codebase (confirmed via
     `grep -rn "createPortal\|document.body" apps/web/src/components/ui/*.tsx` — no
     prior hits), so there's no existing convention to fall back on for stacking above
     other content. The only existing `z-*` usage found is `TagInput`'s dropdown
     (`z-10`, `tag-input.tsx:174`) — the plan should at minimum state the Modal backdrop
     needs a `z-index` higher than that and pick a value, rather than leaving it
     implicit.
   - `Modal` is meant to be generic/reusable and this ticket explicitly anticipates a
     future create/edit-task modal consumer (issue text). A form with several fields
     (title, notes, due date via `DateTimePicker`, tags via `TagInput`) is a realistic
     near-term children payload that could exceed viewport height on a small screen —
     without an overflow strategy specified now, the component either clips content or
     pushes the close button off-screen, and whoever implements this has to invent the
     answer unguided.
   This is exactly the "vague exactly where it should be specific" failure mode: the
   plan over-specifies focus mechanics and under-specifies the basic visual contract of
   the thing being built.

2. **Escape-listener attachment point (document vs. panel) is unstated.** §2.4 describes
   the Tab-trap listener as being "on the panel," and the Escape behavior is listed
   alongside it (§2.3's bullet groups Escape with the hand-rolled approach) but never
   says explicitly whether Escape is also a panel-level `keydown` handler (relying on
   focus already being inside the panel, via bubbling) or a `document`-level listener.
   This isn't a stylistic gap — it's an actual correctness question: if Escape is
   implemented as a panel-level handler, it can only fire once focus has actually moved
   into the panel's subtree. Given initial focus is moved by a separate effect, there's
   a real (if narrow) window — before that effect runs/paints — where focus is still on
   the external trigger element and a panel-scoped Escape handler would silently not
   fire. The conventional, safer choice (used by essentially every hand-rolled dialog
   implementation) is a `document`-level `keydown` listener added on mount/`isOpen` and
   removed on cleanup, independent of where focus currently is. The plan should say this
   explicitly rather than leaving the implementer to infer it, given how much care §2.4
   otherwise puts into ordering/timing of focus effects.

3. **Backdrop-click detection doesn't account for text-selection drag.** §2.3 specifies
   backdrop close via the backdrop's own `onClick` checking `event.target ===
   event.currentTarget`. That correctly excludes clicks that both start and end inside
   the panel, but a `click` event's `target` is determined by where `mouseup` occurs,
   not `mousedown` — so a user who starts selecting text inside the panel (e.g. a long
   `description`, or once this is eventually wired into a real form) and drags the
   mouse past the panel edge before releasing will fire a `click` with `target` on the
   backdrop, incorrectly closing the modal mid-interaction. This is the same class of
   interaction-correctness bug the codebase already takes seriously elsewhere —
   `tag-input.tsx`'s `onMouseDown={(e) => e.preventDefault()}` exists specifically to
   suppress a mousedown-triggered side effect race (see its comment at
   `tag-input.tsx:189`). Worth an explicit decision here too: either track `mousedown`
   target separately from `click` (the standard fix — most hand-rolled dialogs record
   whether `mousedown` also started on the backdrop before honoring the `click`), or
   consciously accept the risk and say so. Currently the plan doesn't surface this as a
   choice at all.

None of these three are scope problems — they're implementation-detail gaps in a plan
that is otherwise unusually rigorous about the harder parts (focus trap, restore-on-
close, cleanup on abrupt unmount, `prefers-reduced-motion`). Given the plan's own bar for
itself (flagging every non-obvious decision explicitly, e.g. §2.4's focus-order
paragraph), these three should get the same treatment before implementation starts,
since two of them (Escape attachment point, backdrop drag-click) are genuine correctness
questions, not polish.

### Checked and found sound (no issue)

- `Spinner`'s animation/keyframe claims verified directly against `explore/page-design`
  (`--animate-square-pulse`, `@keyframes square-pulse`, the 4-square
  `animate-square-pulse` + `animationDelay` JSX in `design-explore-page.tsx`) — the plan
  accurately describes what it's porting, not just asserting it.
- `EmptyState`'s reuse of `Panel`'s `role="region"`/`aria-labelledby`/`useId` pattern
  matches `panel.tsx` as it exists today.
- No backend/tRPC/schema changes claimed or needed — correct, this is a pure
  frontend/presentational ticket like its predecessors.
- Test-feasibility claims (portal content reachable via default `screen` queries,
  Tab-trap directly assertable via `fireEvent` + `document.activeElement`) are accurate;
  Testing Library does bind to `document.body` by default and the trap as described
  doesn't depend on jsdom's (non-existent) native tab-focus-movement support.

VERDICT: REVISE

## Round 2

Scoped to the three round-1 gaps per the re-review rule, not a full re-audit.

### 1. Modal visual/layout contract — resolved, substantively

New §2.4 gives concrete, checkable values, not just prose: `z-50` on both backdrop and
panel (justified against the one existing `z-*` precedent, `TagInput`'s `z-10`, with the
reasoning re-verified — `tag-input.tsx:174` does say `z-10`), backdrop
`fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4`, panel
`w-full max-w-lg max-h-[85vh] overflow-y-auto` layered on `Panel`'s existing
`baseClasses`. The "no responsive breakpoints" call is backed by an actual grep claim
(`grep -rln "sm:\|md:\|lg:\|xl:"` across `apps/web/src` — worth a spot check, but plausible
and consistent with what round 1 already saw of this codebase's Tailwind usage). §4 adds a
corresponding test line (backdrop `z-50`; panel `max-w-lg`/`max-h-[85vh]`/`overflow-y-auto`
class-presence) with an explicit, honest testability note explaining why jsdom can't assert
actual scroll behavor and that this is a stated manual-QA gap, not a silently dropped one.
This directly answers round 1's complaint (no `max-width`, no overflow strategy, no
`z-index`) with specific values an implementer can build against without inventing anything.

### 2. Escape-listener attachment point — resolved, correctly

New §2.5 states explicitly: "Escape listener is attached to `document`, not the panel
node," with the timing-window reasoning (focus-move effect vs. Escape-listener effect not
being simultaneous) that round 1 asked for, and a test-form implication
(`fireEvent.keyDown(document, { key: "Escape" })`, explicitly not the panel node) that
would actually catch a regression to a panel-scoped listener. §4's Escape test line matches
this. No ambiguity left.

### 3. Backdrop-click drag-to-select bug — resolved, correctly

New §2.5 second bullet fixes the actual bug: `onMouseDown` records into a `ref` (not
state — correctly reasoned, no re-render needed) whether that mousedown's
`target === currentTarget`; `onClick` only closes when the click-target check **and** the
mousedown-ref both agree the interaction started and ended on the backdrop itself. The
drag-starts-inside-panel-ends-on-backdrop case is walked through explicitly and correctly
rejected by this logic. §4 adds a dedicated "drag-to-select regression case" test that
would fail against the old `event.target === event.currentTarget`-on-`click`-alone
implementation — good, since a fix without a test that can distinguish old-vs-new behavior
wouldn't actually prove the bug is closed.

### Consistency check on the fix itself

No new contradictions introduced: §2.3's "Modal calls all its hooks unconditionally, then
`if (!isOpen) return null`" is consistent with the new document-listener effect being
keyed on `isOpen` (added/removed via cleanup, not skipped via early return). The
README-addition task in §3 was updated to explicitly include "the z-index/visual-contract
note from §2.4," so the new specificity doesn't dead-end in the plan only. One
non-blocking observation, not a gap: both backdrop *and* panel get `z-50` even though the
panel is a DOM descendant of the backdrop's stacking context (so the panel's own `z-50`
looks redundant given nesting) — harmless, not incorrect, not worth another round over.

All three round-1 findings are substantively fixed with concrete values, correct
reasoning, and matching test coverage — not just reworded to sound resolved.

VERDICT: APPROVED
