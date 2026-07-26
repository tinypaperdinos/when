import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Textarea } from "./textarea";

afterEach(() => {
  cleanup();
});

function ControlledTextarea() {
  const [value, setValue] = useState("");
  return (
    <Textarea
      aria-label="controlled"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("Textarea", () => {
  it("round-trips a multi-line value through fireEvent.change", () => {
    render(<ControlledTextarea />);

    const textarea = screen.getByLabelText("controlled") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "line one\nline two" } });

    expect(textarea.value).toBe("line one\nline two");
  });

  it("prevents updates to a controlled value when disabled", () => {
    render(<Textarea aria-label="disabled textarea" value="fixed" disabled onChange={() => {}} />);

    const textarea = screen.getByLabelText("disabled textarea") as HTMLTextAreaElement;
    expect(textarea).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "changed" } });

    expect(textarea.value).toBe("fixed");
  });

  it("forwards the native rows prop alongside the min-h-24 default", () => {
    render(<Textarea aria-label="rows textarea" rows={10} />);

    const textarea = screen.getByLabelText("rows textarea");
    expect(textarea).toHaveAttribute("rows", "10");
    expect(textarea.className).toContain("min-h-24");
  });

  it("merges a consumer-supplied className with the base classes", () => {
    render(<Textarea aria-label="custom" className="custom-class" />);

    const textarea = screen.getByLabelText("custom");
    expect(textarea.className).toContain("custom-class");
    expect(textarea.className).toContain("field-base");
  });

  it("forwards arbitrary native props", () => {
    render(
      <Textarea aria-label="native props" id="notes" name="notes" data-testid="textarea" />,
    );

    const textarea = screen.getByTestId("textarea");
    expect(textarea).toHaveAttribute("id", "notes");
    expect(textarea).toHaveAttribute("name", "notes");
  });

  it("renders with zero props without throwing", () => {
    expect(() => render(<Textarea />)).not.toThrow();
  });
});
