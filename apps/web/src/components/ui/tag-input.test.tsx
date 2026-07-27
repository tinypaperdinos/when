import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TagInput } from "./tag-input";

afterEach(() => {
  cleanup();
});

describe("TagInput", () => {
  it("renders each value entry as a chip with visible text and a Remove <tag>-labeled button", () => {
    render(<TagInput value={["work", "urgent"]} onChange={() => {}} />);

    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove urgent" })).toBeInTheDocument();
  });

  it("with default value=[] and no suggestions, shows an empty input labeled 'Tags', no chips, and no listbox", () => {
    render(<TagInput value={[]} onChange={() => {}} />);

    const input = screen.getByLabelText("Tags") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("typing text that substring-matches a suggestion (case-insensitively) opens the listbox showing only matching, not-already-selected suggestions", () => {
    render(
      <TagInput
        value={["work"]}
        onChange={() => {}}
        suggestions={["Workshop", "urgent", "work"]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "WOR" } });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Workshop" })).toBeInTheDocument();
    // "work" is already selected (case-insensitively) so it must not be offered again.
    expect(screen.queryByRole("option", { name: "work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "urgent" })).not.toBeInTheDocument();
  });

  it("typing text that matches nothing keeps the listbox entirely absent from the DOM", () => {
    render(<TagInput value={[]} onChange={() => {}} suggestions={["work", "urgent"]} />);

    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "zzz" } });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("more than MAX_SUGGESTIONS (8) matches: only the first 8 are rendered as options", () => {
    const suggestions = Array.from({ length: 9 }, (_, i) => `aaa-${i}`);
    render(<TagInput value={[]} onChange={() => {}} suggestions={suggestions} />);

    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "aaa" } });

    expect(screen.getAllByRole("option")).toHaveLength(8);
  });

  it("ArrowDown moves the highlight forward through filtered options, clamping at the last (no wrap)", () => {
    render(
      <TagInput
        value={[]}
        onChange={() => {}}
        suggestions={["apple", "apricot", "avocado"]}
      />,
    );

    const input = screen.getByLabelText("Tags");
    fireEvent.change(input, { target: { value: "a" } });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[2]).toHaveAttribute("aria-selected", "true");

    // A further ArrowDown at the end is a no-op, doesn't wrap to the first.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowUp moves the highlight backward, clamping at the first (no wrap to the last)", () => {
    render(
      <TagInput
        value={[]}
        onChange={() => {}}
        suggestions={["apple", "apricot", "avocado"]}
      />,
    );

    const input = screen.getByLabelText("Tags");
    fireEvent.change(input, { target: { value: "a" } });

    const options = screen.getAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    // A further ArrowUp at the start is a no-op, doesn't wrap to the last.
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[2]).toHaveAttribute("aria-selected", "false");
  });

  it("Enter with a highlighted suggestion commits that suggestion: onChange called once with value plus the tag, input clears, listbox closes", () => {
    const onChange = vi.fn();
    render(<TagInput value={["urgent"]} onChange={onChange} suggestions={["work"]} />);

    const input = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wor" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["urgent", "work"]);
    expect(input.value).toBe("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Enter with no highlighted suggestion and non-empty draft commits the typed text verbatim (original casing preserved)", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    const input = screen.getByLabelText("Tags");
    fireEvent.change(input, { target: { value: "Some New Tag" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["Some New Tag"]);
  });

  it("Enter with an empty draft and nothing highlighted does not call onChange", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter on text that case-insensitively duplicates an already-selected tag: onChange is not called, but draft clears and listbox closes", () => {
    const onChange = vi.fn();
    render(
      <TagInput value={["Work"]} onChange={onChange} suggestions={["work", "workout"]} />,
    );

    const input = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "work" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clicking a rendered suggestion option commits it the same way Enter-with-highlight does", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} suggestions={["work"]} />);

    const input = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wor" } });

    const option = screen.getByRole("option", { name: "work" });
    const button = option.querySelector("button") as HTMLButtonElement;

    fireEvent.mouseDown(button);
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["work"]);
    expect(input.value).toBe("");
  });

  // This is the actual, distinguishable regression guard for
  // `onMouseDown={(e) => e.preventDefault()}` on each suggestion button. This repo's
  // `fireEvent`-only test convention (no `user-event`) does not simulate the browser's
  // real mousedown default-action chain (mousedown -> focus-shift -> blur-of-previous-
  // element) in jsdom, so asserting `document.activeElement` after a click can't tell
  // apart "the handler works" from "jsdom never moved focus in the first place" (verified
  // empirically with a throwaway scratch spec during implementation, matching
  // `refiner-notes.md` round 2's finding). Instead, this asserts the lower-level,
  // directly-checkable fact `fireEvent` *can* observe: `element.dispatchEvent(event)`
  // returns `false` for a cancelable event exactly when a handler called
  // `preventDefault()` on it. That genuinely fails if `onMouseDown` is removed (verified
  // by temporarily deleting the handler during implementation and confirming this
  // assertion — and only this assertion in this file — failed, then restoring it).
  it("calls preventDefault() on mousedown for a suggestion button (suppresses the blur-before-click race)", () => {
    render(<TagInput value={[]} onChange={() => {}} suggestions={["work"]} />);

    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "wor" } });

    const option = screen.getByRole("option", { name: "work" });
    const button = option.querySelector("button") as HTMLButtonElement;

    const notPrevented = fireEvent.mouseDown(button);

    expect(notPrevented).toBe(false);
  });

  it("Escape while the listbox is open closes it without clearing the draft text", () => {
    render(<TagInput value={[]} onChange={() => {}} suggestions={["work"]} />);

    const input = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wor" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input.value).toBe("wor");
  });

  it("Backspace with an empty draft and existing tags removes the last tag via onChange, preserving the rest", () => {
    const onChange = vi.fn();
    render(<TagInput value={["work", "urgent", "home"]} onChange={onChange} />);

    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Backspace" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["work", "urgent"]);
  });

  it("Backspace with a non-empty draft does not call onChange (normal text editing)", () => {
    const onChange = vi.fn();
    render(<TagInput value={["work"]} onChange={onChange} />);

    const input = screen.getByLabelText("Tags");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking a specific chip's remove button removes exactly that tag, preserving order of the rest (including removing from the middle)", () => {
    const onChange = vi.fn();
    render(<TagInput value={["work", "urgent", "home"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove urgent" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["work", "home"]);
  });

  it("disabled: input and remove buttons are disabled, typing never opens the listbox, and clicking a disabled remove button does not call onChange", () => {
    const onChange = vi.fn();
    render(
      <TagInput
        value={["work"]}
        onChange={onChange}
        suggestions={["work", "urgent"]}
        disabled
      />,
    );

    const input = screen.getByLabelText("Tags");
    expect(input).toBeDisabled();

    const removeButton = screen.getByRole("button", { name: "Remove work" });
    expect(removeButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "urg" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(removeButton);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("with suggestions omitted, typing never opens a listbox, but Enter still commits freeform tags and remove-button removal still works", () => {
    const onChange = vi.fn();
    render(<TagInput value={["work"]} onChange={onChange} />);

    const input = screen.getByLabelText("Tags");
    fireEvent.change(input, { target: { value: "urgent" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["work", "urgent"]);

    // value is a static prop in this test (not re-synced from the onChange call above),
    // so removal is computed against the original value=["work"], not the just-committed
    // one — this still proves the remove-button path works standalone.
    fireEvent.click(screen.getByRole("button", { name: "Remove work" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("merges a consumer-supplied className onto the outer wrapping div", () => {
    const { container } = render(
      <TagInput value={[]} onChange={() => {}} className="custom-class" />,
    );

    expect(container.firstElementChild?.className).toContain("custom-class");
  });

  it("reflects label/placeholder overrides on the input, without also rendering the defaults", () => {
    render(
      <TagInput
        value={[]}
        onChange={() => {}}
        label="Custom label"
        placeholder="Custom placeholder"
      />,
    );

    expect(screen.getByLabelText("Custom label")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tags")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add a tag…")).not.toBeInTheDocument();
  });

  it("aria-expanded reflects open state, aria-activedescendant reflects the highlighted option", () => {
    render(<TagInput value={[]} onChange={() => {}} suggestions={["work"]} />);

    const input = screen.getByLabelText("Tags");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");

    fireEvent.change(input, { target: { value: "wor" } });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).not.toHaveAttribute("aria-activedescendant");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const listbox = screen.getByRole("listbox");
    const option = screen.getByRole("option", { name: "work" });
    expect(option.id).toBe(`${listbox.id}-option-0`);
    expect(input).toHaveAttribute("aria-activedescendant", option.id);
  });

  it("renders two simultaneous instances with distinct listbox/option ids", () => {
    render(
      <>
        <TagInput
          value={[]}
          onChange={() => {}}
          suggestions={["work"]}
          label="Tags A"
        />
        <TagInput
          value={[]}
          onChange={() => {}}
          suggestions={["work"]}
          label="Tags B"
        />
      </>,
    );

    fireEvent.change(screen.getByLabelText("Tags A"), { target: { value: "wor" } });
    fireEvent.change(screen.getByLabelText("Tags B"), { target: { value: "wor" } });

    const listboxes = screen.getAllByRole("listbox");
    expect(listboxes).toHaveLength(2);
    expect(listboxes[0].id).not.toBe(listboxes[1].id);
  });

  it("renders without throwing given only the minimum required props", () => {
    expect(() => render(<TagInput value={[]} onChange={() => {}} />)).not.toThrow();
  });
});
