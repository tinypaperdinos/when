# Review notes — tests (reviewer-tests)

## reviewer-tests — round 1

Scope: `git diff main...feat/feedback-components`, checked against `plan.md` §4's
edge-case list and `ticket.md` (GitHub issue #19). Ran the full `apps/web` test suite
(`npm test --workspace=apps/web -- --run`): 236/236 passing, 23 test files, including all
5 touched/new files (`spinner.test.tsx`, `loading-state.test.tsx`, `empty-state.test.tsx`,
`modal.test.tsx`, `ui-demo-page.test.tsx`) and the untouched `tasks-page.test.tsx`
(regression check per plan §4's final bullet).

### Coverage against plan §4, by component

**Spinner** — all plan-listed cases covered (`size` sm/md distinct dimensions,
always-`aria-hidden`), plus extra tests not required by the plan (default size, a
consumer can't override `aria-hidden` via spread order, className merge, 4-square count).

**LoadingState** — default label, custom label override, `role="status"` +
`aria-live="polite"` all covered, plus bonus size-forwarding/className-merge tests.

**EmptyState** — title-only render, icon/description/action render with the action
genuinely wired to a real `onClick` (`fireEvent.click` + `vi.fn()` assertion, not a
mock-presence check), and `role="region"`/`aria-labelledby` verified via
`screen.getByRole("region", { name: "No tasks yet" })` — this resolves the accessible
name through the actual `aria-labelledby` DOM linkage rather than just asserting the
attribute exists, so it would catch a broken `id`/`aria-labelledby` mismatch.

**Modal** — this is the highest-risk surface per plan §4 and it's covered essentially
1:1 against the plan's list: null-when-closed (including `container.innerHTML === ""`,
not just a `queryByRole` miss), `role="dialog"`/`aria-modal`/`aria-labelledby` (again via
`name:` matcher, so it resolves through the real attribute, not just presence),
conditional `aria-describedby`, direct backdrop click, click-inside-panel no-op, the
drag-to-select regression case, `closeOnBackdropClick={false}` no-op (both direct and
drag variants), `Escape` via `fireEvent.keyDown(document, ...)`, `closeOnEscape={false}`
no-op, close button, `z-50`/`max-w-lg`/`max-h-[85vh]`/`overflow-y-auto` class-presence,
default initial focus (close button, by DOM order) and `initialFocusRef` override, Tab/
Shift+Tab wrap-around asserted via `document.activeElement`, focus-restore-on-close
(including the "trigger removed from DOM" no-throw guard), body-scroll-lock with
restore-to-prior-value on both the isOpen-flips-false path and the unmount-while-open
path (both explicitly exercised, matching plan's call to cover both via the same cleanup
without treating them as separate code branches), and the portal-reachability check
(`container.contains(dialog) === false`, `document.body.contains(dialog) === true`).

### Verification that key tests would actually catch a regression (not just co-pass)

Traced by hand rather than by literally reverting `modal.tsx` (reviewer-tests doesn't
edit files; a `Bash` attempt to patch a throwaway copy for this purpose was also blocked
by the sandbox's classifier, consistent with the "findings only" role boundary — treating
that as confirmation rather than working around it):

- **Drag-to-select regression test** (`modal.test.tsx:127`): `mousedown` on the dialog
  panel, then `click` on the backdrop. Under the naive `event.target ===
  event.currentTarget`-on-`click`-alone check the plan explicitly says was the prior,
  insufficient approach, `click`'s target *is* the backdrop (mouseup resolves the
  target), so `target === currentTarget` would be true and `onClose` would fire —
  the test's `expect(onClose).not.toHaveBeenCalled()` would fail. This test is a real
  differentiator for the mousedown-tracking-ref fix, not a coincidentally-passing check.
- **Document-level Escape test** (`modal.test.tsx:163`): dispatches
  `fireEvent.keyDown(document, { key: "Escape" })`, not on the panel node. A
  panel-scoped listener (attached via a ref-based `addEventListener` on the panel
  element, or via React's `onKeyDown` on the panel div) would never receive a `keydown`
  dispatched directly at `document` — DOM event dispatch to `document` doesn't trigger
  descendant-attached listeners without an actual bubble path originating from inside
  those descendants. So this test form is a genuine regression catch for §2.5's
  document-vs-panel-scoped distinction, exactly as the plan calls out.
- **Tab-wrap tests**: `handlePanelKeyDown` is exercised via `fireEvent.keyDown` on the
  actually-focused element with `document.activeElement` assertions after — this
  directly exercises the real trap logic (recomputed focusable list, `preventDefault` +
  explicit `.focus()`), not a mocked call-count check.

### Non-blocking observations

- No test asserts the document-level `keydown` listener is actually removed once the
  modal closes (e.g., open → close → dispatch `Escape` again → `onClose` not called a
  second time). The effect's cleanup (keyed on `[isOpen, closeOnEscape, onClose]`) makes
  this low-risk by inspection, and no consumer currently keeps a closed-but-mounted
  `Modal` around long enough for a stray listener to matter, but it's a one-line addition
  that would directly guard the `useEffect` dependency array against a future regression
  (e.g. someone changing the array and silently keeping a stale listener attached).
- No dedicated test for `Tab` pressed while focus is on a *middle* (non-first/non-last)
  focusable element, confirming the trap is a no-op there (natural browser tab order
  should proceed, i.e. `preventDefault` should NOT fire). Plan §4 only calls for the two
  wrap-around cases, so this isn't a plan-mandated gap, just a slightly narrower net than
  it could be — trivial, not blocking.
- `tasks-page.test.tsx` was left unchanged (no `role="status"` assertion added), which
  plan §4 explicitly marks as optional/not required for "done" — not a gap.

### Ticket/plan scope fidelity (tests side)

- No backend/tRPC/schema test changes — matches plan (§5, "no backend/tRPC/schema
  changes").
- No tests wiring `Modal` into `task-create-form.tsx`/`task-list-item.tsx` — matches
  plan §0/§5 (deliberately out of scope, no existing ad-hoc modal call site to migrate).
- `ui-demo-page.test.tsx` additions match the "genuinely interactive" bar set by
  `DateTimePicker`/`TagInput` precedent: the Modal demo test actually opens (click
  trigger → `getByRole("dialog", { name: ... })`), closes via the close button, and a
  second test closes via `Escape` — real interaction, not just checking the trigger
  button renders.

No blocking findings. Test coverage is thorough, matches plan §4's edge-case list
closely (including the two edge cases the ticket brief specifically flagged — focus trap
and document-level Escape — plus the backdrop-click drag-to-select regression and the
z-index/layout class-presence assertions), and the highest-risk assertions (backdrop
drag regression, document-level Escape) were traced to confirm they'd actually fail
against the naive/buggy alternative the plan describes, not just pass coincidentally
against both.

VERDICT: APPROVED
