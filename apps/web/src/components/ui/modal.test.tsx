import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useRef, useState } from "react";
import { Modal } from "./modal";

afterEach(() => {
  cleanup();
});

function getBackdrop(): HTMLElement {
  return screen.getByRole("dialog").parentElement as HTMLElement;
}

function ModalDemo() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open modal
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit task">
        <p>Modal body</p>
      </Modal>
    </div>
  );
}

function RemovableTriggerModalDemo() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTrigger, setShowTrigger] = useState(true);
  return (
    <div>
      {showTrigger && (
        <button type="button" onClick={() => setIsOpen(true)}>
          Open modal
        </button>
      )}
      <button type="button" onClick={() => setShowTrigger(false)}>
        Remove trigger
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit task">
        <p>Modal body</p>
      </Modal>
    </div>
  );
}

function InitialFocusRefDemo() {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <Modal isOpen onClose={() => {}} title="Edit task" initialFocusRef={ref}>
      <button type="button" ref={ref}>
        First field
      </button>
      <button type="button">Last field</button>
    </Modal>
  );
}

describe("Modal", () => {
  it("renders nothing (null) when isOpen is false — no dialog in the DOM at all", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="T">
        body
      </Modal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });

  it("exposes role=dialog, aria-modal=true, and aria-labelledby resolving to the title when open", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Edit task">
        body
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).not.toHaveAttribute("aria-describedby");
  });

  it("exposes aria-describedby only when description is supplied", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Edit task" description="Some helper text">
        body
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    const describedById = dialog.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(screen.getByText("Some helper text").id).toBe(describedById);
  });

  it("backdrop click (mousedown and click both landing directly on the overlay) calls onClose", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );

    const backdrop = getBackdrop();
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a click that originates and ends inside the panel does not call onClose", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("drag-to-select regression: mousedown inside the panel followed by a click landing on the backdrop does not call onClose", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = getBackdrop();
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop click is a no-op when closeOnBackdropClick is false (direct click and the drag case)", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" closeOnBackdropClick={false}>
        body
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = getBackdrop();

    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape key calls onClose via a document-level listener", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape is a no-op when closeOnEscape is false", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" closeOnEscape={false}>
        body
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("the built-in close button calls onClose", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop carries z-50; panel carries max-w-lg, max-h-[85vh], and overflow-y-auto", () => {
    render(
      <Modal isOpen onClose={() => {}} title="T">
        body
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(getBackdrop().className).toContain("z-50");
    expect(dialog.className).toContain("max-w-lg");
    expect(dialog.className).toContain("max-h-[85vh]");
    expect(dialog.className).toContain("overflow-y-auto");
  });

  it("initial focus lands on the first focusable descendant (the close button) by default", () => {
    render(
      <Modal isOpen onClose={() => {}} title="T">
        <button type="button">First field</button>
      </Modal>,
    );

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("initial focus lands on initialFocusRef.current when supplied", () => {
    render(<InitialFocusRefDemo />);

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "First field" }),
    );
  });

  it("Tab from the last focusable descendant wraps focus to the first", () => {
    render(
      <Modal isOpen onClose={() => {}} title="T">
        <button type="button">First field</button>
        <button type="button">Last field</button>
      </Modal>,
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    const lastField = screen.getByRole("button", { name: "Last field" });
    lastField.focus();

    fireEvent.keyDown(lastField, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("Shift+Tab from the first focusable descendant wraps focus to the last", () => {
    render(
      <Modal isOpen onClose={() => {}} title="T">
        <button type="button">First field</button>
        <button type="button">Last field</button>
      </Modal>,
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    const lastField = screen.getByRole("button", { name: "Last field" });
    closeButton.focus();

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(lastField);
  });

  it("restores focus to the previously-focused element once isOpen flips back to false", () => {
    render(<ModalDemo />);

    const trigger = screen.getByRole("button", { name: "Open modal" });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.click(closeButton);

    expect(document.activeElement).toBe(trigger);
  });

  it("focus-restore is a no-op (doesn't throw) if the previously-focused element is no longer in the DOM when the modal closes", () => {
    render(<RemovableTriggerModalDemo />);

    const trigger = screen.getByRole("button", { name: "Open modal" });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Remove trigger" }));
    expect(screen.queryByRole("button", { name: "Open modal" })).not.toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(() => fireEvent.click(closeButton)).not.toThrow();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("locks body scroll while open and restores the prior inline value after close", () => {
    document.body.style.overflow = "";
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} title="T">
        body
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal isOpen={false} onClose={() => {}} title="T">
        body
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("");
  });

  it("locks body scroll while open and restores the prior inline value on unmount while still open", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = render(
      <Modal isOpen onClose={() => {}} title="T">
        body
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });

  it("renders content reachable via document.body-scoped screen queries even though invoked from elsewhere in the tree", () => {
    const { container } = render(
      <div>
        <div>
          <Modal isOpen onClose={() => {}} title="Edit task">
            body
          </Modal>
        </div>
      </div>,
    );

    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });
});
