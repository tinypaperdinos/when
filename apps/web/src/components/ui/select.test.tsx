import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Select } from "./select";

afterEach(() => {
  cleanup();
});

function ControlledSelect() {
  const [value, setValue] = useState("");
  return (
    <Select aria-label="controlled" value={value} onChange={(event) => setValue(event.target.value)}>
      <option value="a">Option A</option>
      <option value="b">Option B</option>
    </Select>
  );
}

describe("Select", () => {
  it("renders provided option children and their text", () => {
    render(
      <Select aria-label="fruits">
        <option value="apple">Apple</option>
        <option value="banana">Banana</option>
      </Select>,
    );

    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
  });

  it("updates a controlled value via fireEvent.change", () => {
    render(<ControlledSelect />);

    const select = screen.getByLabelText("controlled") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "b" } });

    expect(select.value).toBe("b");
  });

  it("shows a disabled placeholder option that is selected by default when no value/defaultValue is given", () => {
    const { container } = render(
      <Select aria-label="pick one" placeholder="Choose…">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>,
    );

    const select = screen.getByLabelText("pick one") as HTMLSelectElement;
    const placeholderOption = container.querySelector('option[value=""]') as HTMLOptionElement;

    expect(placeholderOption).toBeDisabled();
    expect(placeholderOption.textContent).toBe("Choose…");
    expect(select.value).toBe("");
  });

  it("prevents changes to a controlled value when disabled", () => {
    render(
      <Select aria-label="disabled select" value="b" disabled onChange={() => {}}>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>,
    );

    const select = screen.getByLabelText("disabled select") as HTMLSelectElement;
    expect(select).toBeDisabled();

    fireEvent.change(select, { target: { value: "a" } });

    expect(select.value).toBe("b");
  });

  it("renders an empty select with no placeholder without throwing", () => {
    expect(() => render(<Select aria-label="empty" />)).not.toThrow();
  });

  it("merges a consumer-supplied className onto the select, not the wrapping div", () => {
    render(
      <Select aria-label="custom" className="custom-class">
        <option value="a">Option A</option>
      </Select>,
    );

    const select = screen.getByLabelText("custom");
    expect(select.className).toContain("custom-class");
    expect(select.parentElement?.className).not.toContain("custom-class");
  });

  it("forwards arbitrary native props", () => {
    render(
      <Select aria-label="native props" id="category" name="category" required>
        <option value="a">Option A</option>
      </Select>,
    );

    const select = screen.getByLabelText("native props");
    expect(select).toHaveAttribute("id", "category");
    expect(select).toHaveAttribute("name", "category");
    expect(select).toBeRequired();
  });
});
