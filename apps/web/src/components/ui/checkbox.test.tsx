import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Checkbox } from "./checkbox";

afterEach(() => {
  cleanup();
});

describe("Checkbox", () => {
  it("is unchecked by default", () => {
    render(<Checkbox label="Subscribe" />);

    expect(screen.getByRole("checkbox", { name: "Subscribe" })).not.toBeChecked();
  });

  it("toggles on click of the checkbox itself (uncontrolled)", () => {
    render(<Checkbox label="Subscribe" />);

    const checkbox = screen.getByRole("checkbox", { name: "Subscribe" }) as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(true);
  });

  it("toggles on click of the visible label text", () => {
    render(<Checkbox label="Subscribe" />);

    const checkbox = screen.getByRole("checkbox", { name: "Subscribe" }) as HTMLInputElement;
    fireEvent.click(screen.getByText("Subscribe"));

    expect(checkbox.checked).toBe(true);
  });

  it("respects defaultChecked", () => {
    render(<Checkbox label="Subscribe" defaultChecked />);

    expect(screen.getByRole("checkbox", { name: "Subscribe" })).toBeChecked();
  });

  it("respects a controlled checked prop", () => {
    render(<Checkbox label="Subscribe" checked onChange={() => {}} />);

    expect(screen.getByRole("checkbox", { name: "Subscribe" })).toBeChecked();
  });

  it("fires onChange on toggle", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Subscribe" onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe" }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("prevents toggling via click and applies dimmed wrapper styling when disabled", () => {
    render(<Checkbox label="Subscribe" disabled />);

    const checkbox = screen.getByRole("checkbox", { name: "Subscribe" }) as HTMLInputElement;
    expect(checkbox).toBeDisabled();

    checkbox.click();
    expect(checkbox.checked).toBe(false);

    const wrapper = checkbox.closest("label");
    expect(wrapper?.className).toContain("opacity-50");
    expect(wrapper?.className).toContain("cursor-not-allowed");
  });

  it("is reachable via aria-label when no label prop is given", () => {
    render(<Checkbox aria-label="Accept terms" />);

    expect(screen.getByLabelText("Accept terms")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument();
  });

  it("applies a consumer-supplied className to the wrapping label, not the input", () => {
    render(<Checkbox label="Subscribe" className="custom-class" />);

    const checkbox = screen.getByRole("checkbox", { name: "Subscribe" });
    const wrapper = checkbox.closest("label");

    expect(wrapper?.className).toContain("custom-class");
    expect(checkbox.className).not.toContain("custom-class");
  });

  it("forwards arbitrary native input props onto the input, not the wrapper", () => {
    render(<Checkbox label="Subscribe" id="subscribe" name="subscribe" data-testid="checkbox-input" />);

    const checkbox = screen.getByTestId("checkbox-input");
    expect(checkbox).toHaveAttribute("id", "subscribe");
    expect(checkbox).toHaveAttribute("name", "subscribe");

    const wrapper = checkbox.closest("label");
    expect(wrapper).not.toHaveAttribute("data-testid", "checkbox-input");
  });
});
