import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ChevronDownIcon } from "./chevron-down-icon";

describe("ChevronDownIcon", () => {
  it("renders an svg with the chevron path", () => {
    const { container } = render(<ChevronDownIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("forwards arbitrary svg props, including className", () => {
    const { container } = render(<ChevronDownIcon className="custom-class" data-testid="chevron" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
    expect(svg).toHaveAttribute("data-testid", "chevron");
  });
});
