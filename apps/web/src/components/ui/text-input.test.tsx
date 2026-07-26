import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { TextInput, type TextInputSize } from "./text-input";

afterEach(() => {
  cleanup();
});

const sizes: TextInputSize[] = ["sm", "md"];

function ControlledTextInput() {
  const [value, setValue] = useState("");
  return (
    <TextInput
      aria-label="controlled"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("TextInput", () => {
  for (const size of sizes) {
    it(`renders the ${size} size with its documented padding/text-size classes`, () => {
      render(<TextInput size={size} aria-label={size} />);

      const input = screen.getByLabelText(size);
      if (size === "sm") {
        expect(input.className).toContain("px-2");
        expect(input.className).toContain("py-1");
        expect(input.className).toContain("text-sm");
        expect(input.className).not.toContain("px-3");
      } else {
        expect(input.className).toContain("px-3");
        expect(input.className).toContain("py-2");
        expect(input.className).toContain("text-base");
        expect(input.className).not.toContain("px-2");
      }
    });
  }

  it("defaults to the md size when size is omitted", () => {
    render(<TextInput aria-label="default" />);

    const input = screen.getByLabelText("default");
    expect(input.className).toContain("px-3");
    expect(input.className).toContain("py-2");
  });

  it("supports controlled updates via value/onChange", () => {
    render(<ControlledTextInput />);

    const input = screen.getByLabelText("controlled") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });

    expect(input.value).toBe("hello");
  });

  it("renders a placeholder", () => {
    render(<TextInput placeholder="Type here" />);

    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("prevents updates to a controlled value when disabled", () => {
    render(<TextInput aria-label="disabled input" value="fixed" disabled onChange={() => {}} />);

    const input = screen.getByLabelText("disabled input") as HTMLInputElement;
    expect(input).toBeDisabled();

    fireEvent.change(input, { target: { value: "changed" } });

    expect(input.value).toBe("fixed");
  });

  it("merges a consumer-supplied className with the base classes", () => {
    render(<TextInput aria-label="custom" className="custom-class" />);

    const input = screen.getByLabelText("custom");
    expect(input.className).toContain("custom-class");
    expect(input.className).toContain("border-ink");
  });

  it("forwards arbitrary native props", () => {
    render(
      <TextInput
        aria-label="native props"
        id="task-name"
        name="taskName"
        required
        data-testid="text-input"
      />,
    );

    const input = screen.getByTestId("text-input");
    expect(input).toHaveAttribute("id", "task-name");
    expect(input).toHaveAttribute("name", "taskName");
    expect(input).toBeRequired();
  });

  it("renders with zero props without throwing", () => {
    expect(() => render(<TextInput />)).not.toThrow();
  });
});
