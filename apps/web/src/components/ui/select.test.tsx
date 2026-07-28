import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Select } from "./select";

afterEach(() => {
  cleanup();
});

describe("Select", () => {
  it("shows placeholder text (muted) when no value/defaultValue is set; the placeholder is not itself a selectable option", () => {
    render(
      <Select aria-label="fruit" placeholder="Choose a fruit…">
        <option value="a">Apple</option>
        <option value="b">Banana</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    expect(trigger).toHaveTextContent("Choose a fruit…");
    expect(trigger.querySelector("span")?.className).toContain("text-ink/40");

    fireEvent.click(trigger);
    expect(screen.queryByRole("option", { name: "Choose a fruit…" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("defaultValue (uncontrolled): trigger shows that option's label on first render, no interaction required", () => {
    render(
      <Select aria-label="fruit" defaultValue="b">
        <option value="a">Apple</option>
        <option value="b">Banana</option>
      </Select>,
    );

    expect(screen.getByRole("button", { name: "fruit" })).toHaveTextContent("Banana");
  });

  it("uncontrolled (no value prop): clicking a different option updates the trigger's own displayed label via internal state, with no onChange required", () => {
    render(
      <Select aria-label="fruit" defaultValue="a">
        <option value="a">Apple</option>
        <option value="b">Banana</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    expect(trigger).toHaveTextContent("Apple");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Banana" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Banana");
  });

  it("value (controlled): clicking the trigger opens the popup; clicking an option calls onChange once and closes; the trigger's label only updates once the consumer feeds the new value back in", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Select aria-label="fruit" value="a" onChange={onChange}>
        <option value="a">Apple</option>
        <option value="b">Banana</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    expect(trigger).toHaveTextContent("Apple");

    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Banana" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // Genuinely controlled — the label doesn't self-update from the click above.
    expect(trigger).toHaveTextContent("Apple");

    rerender(
      <Select aria-label="fruit" value="b" onChange={onChange}>
        <option value="a">Apple</option>
        <option value="b">Banana</option>
      </Select>,
    );
    expect(trigger).toHaveTextContent("Banana");
  });

  it("keyboard: ArrowDown from a closed trigger opens the popup and highlights the first option; repeated ArrowDown/ArrowUp moves the highlight, clamped at the ends (no wraparound); Enter commits the highlighted option and closes", () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="fruit" value="" onChange={onChange}>
        <option value="a">Apple</option>
        <option value="b">Banana</option>
        <option value="c">Cherry</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    let options = screen.getAllByRole("option");
    expect(trigger).toHaveAttribute("aria-activedescendant", options[0].id);

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    options = screen.getAllByRole("option");
    expect(trigger).toHaveAttribute("aria-activedescendant", options[1].id);

    // Two more ArrowDowns: one real move to the last option, one no-op clamp at the end.
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    options = screen.getAllByRole("option");
    expect(trigger).toHaveAttribute("aria-activedescendant", options[2].id);

    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    options = screen.getAllByRole("option");
    expect(trigger).toHaveAttribute("aria-activedescendant", options[1].id);

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ArrowUp from a closed trigger with no value highlights the last option (clamped, no wrap)", () => {
    render(
      <Select aria-label="fruit">
        <option value="a">Apple</option>
        <option value="b">Banana</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    fireEvent.keyDown(trigger, { key: "ArrowUp" });

    const options = screen.getAllByRole("option");
    expect(trigger).toHaveAttribute("aria-activedescendant", options[1].id);
  });

  it("Escape closes the popup without calling onChange", () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="fruit" onChange={onChange}>
        <option value="a">Apple</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disabled options are skipped by arrow-key traversal and produce no onChange when clicked", () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="fruit" onChange={onChange}>
        <option value="a">Apple</option>
        <option value="b" disabled>
          Banana
        </option>
        <option value="c">Cherry</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // highlights Apple (index 0)
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // Banana is disabled, skip to Cherry

    const options = screen.getAllByRole("option");
    expect(trigger).toHaveAttribute("aria-activedescendant", options[2].id);

    fireEvent.click(options[1]);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("disabled: the trigger cannot be opened via click or keyboard", () => {
    render(
      <Select aria-label="fruit" disabled>
        <option value="a">Apple</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("required is reflected as aria-required on the trigger", () => {
    render(
      <Select aria-label="fruit" required>
        <option value="a">Apple</option>
      </Select>,
    );

    expect(screen.getByRole("button", { name: "fruit" })).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("merges a consumer-supplied className onto the trigger, not the wrapping div", () => {
    render(
      <Select aria-label="fruit" className="custom-class">
        <option value="a">Apple</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    expect(trigger.className).toContain("custom-class");
    expect(trigger.parentElement?.className).not.toContain("custom-class");
  });

  it("forwards id and name onto the trigger", () => {
    render(
      <Select aria-label="fruit" id="category" name="category">
        <option value="a">Apple</option>
      </Select>,
    );

    const trigger = screen.getByRole("button", { name: "fruit" });
    expect(trigger).toHaveAttribute("id", "category");
    expect(trigger).toHaveAttribute("name", "category");
  });

  it("throws a clear error when an <option>'s own children isn't a plain string", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <Select aria-label="bad">
          <option value="a">{42}</option>
        </Select>,
      ),
    ).toThrow(/plain string label/);

    consoleError.mockRestore();
  });

  it("renders without throwing given a single <option> child and no other props", () => {
    expect(() =>
      render(
        <Select aria-label="minimal">
          <option value="a">Apple</option>
        </Select>,
      ),
    ).not.toThrow();
  });

  // This repo's fireEvent-only test convention can't simulate the real browser
  // mousedown->focus-shift->blur chain in jsdom (see tag-input.test.tsx's own comment on
  // its equivalent regression test) — so this asserts the lower-level, directly-checkable
  // fact `fireEvent` can observe: a cancelable event's `dispatchEvent` return value is
  // `false` exactly when a handler called `preventDefault()` on it.
  it("calls preventDefault() on mousedown for an option (suppresses the blur-before-click race)", () => {
    render(
      <Select aria-label="fruit">
        <option value="a">Apple</option>
      </Select>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fruit" }));
    const option = screen.getByRole("option", { name: "Apple" });

    const notPrevented = fireEvent.mouseDown(option);

    expect(notPrevented).toBe(false);
  });
});
