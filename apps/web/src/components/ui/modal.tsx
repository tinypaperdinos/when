import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode; // required — a dialog that interrupts the whole page needs an
  // accessible name essentially always (deliberate deviation from Panel's optional
  // title — see tickets/feedback-components/plan.md §2.3).
  description?: ReactNode;
  children: ReactNode;
  className?: string; // applied to the dialog panel, not the backdrop
  closeOnBackdropClick?: boolean; // default true
  closeOnEscape?: boolean; // default true
  initialFocusRef?: RefObject<HTMLElement | null>; // see §2.6
}

// Standard focusable-selector list, queried live (not cached once) since modal body
// content can itself change (e.g. a form with a conditionally-rendered field).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Hand-rolled role="dialog" + createPortal, not native <dialog>, not a new dependency —
// consistent with TagInput's precedent of hand-rolling ARIA widget behavior rather than
// reaching for a library (components/ui/README.md, tickets/feedback-components/plan.md
// §2.3). Controlled-only (isOpen/onClose), no defaultOpen escape hatch.
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  initialFocusRef,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Tracks whether the most recent backdrop mousedown itself landed directly on the
  // backdrop (not a panel descendant) — a ref, not state, since it doesn't need a
  // re-render. See §2.5: a click event's target is resolved from mouseup, not
  // mousedown, so a text-selection drag starting inside the panel and releasing past
  // its edge would otherwise be misread as a backdrop click.
  const backdropMouseDownOnSelfRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  // Escape: a document-level listener, not panel-scoped. There's a real window between
  // open and the focus-effect below completing where document.activeElement is still
  // the external trigger element; a panel-scoped handler (relying on bubbling from
  // whatever currently has focus) would silently miss Escape presses in that window.
  // Hooks run unconditionally (rules-of-hooks) — every effect no-ops internally when
  // isOpen is false rather than being skipped via an early return before the hooks run.
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Initial focus on open + focus restore on close/unmount. The cleanup below fires
  // both when isOpen flips back to false and when the component unmounts while still
  // open — same cleanup function covers both paths.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const target =
      initialFocusRef?.current ?? (panelRef.current ? getFocusable(panelRef.current)[0] : undefined);
    target?.focus();

    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  // Background scroll lock — cleanup restores the previously captured inline value
  // (not a hardcoded ""), in case something else already had an opinion on overflow.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleBackdropMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    backdropMouseDownOnSelfRef.current = event.target === event.currentTarget;
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (
      closeOnBackdropClick &&
      event.target === event.currentTarget &&
      backdropMouseDownOnSelfRef.current
    ) {
      onClose();
    }
  }

  // Focus trap: fully driven by this handler calling .focus() explicitly, not the
  // browser's native Tab-key focus movement — recomputes first/last focusable
  // descendants on every keypress (same live-query reasoning as above).
  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;

    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !panelRef.current.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          "w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-sm border-2 border-ink bg-paper p-6 shadow-hard",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-line pb-3">
          <div className="space-y-1">
            <h2 id={titleId} className="text-lg font-medium">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-ink/60">
                {description}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="icon"
            size="sm"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </Button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
