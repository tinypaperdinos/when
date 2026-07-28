import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Spinner, type SpinnerSize } from "./spinner";

afterEach(() => {
  cleanup();
});

describe("Spinner", () => {
  const sizes: SpinnerSize[] = ["sm", "md"];

  for (const size of sizes) {
    it(`renders the ${size} size's distinct dimensions`, () => {
      const { container } = render(<Spinner size={size} data-testid="spinner" />);

      const spinner = container.querySelector('[data-testid="spinner"]');
      expect(spinner?.className).toContain(size === "sm" ? "size-6" : "size-8");
    });
  }

  it("defaults to md size when size is omitted", () => {
    const { container } = render(<Spinner data-testid="spinner" />);

    const spinner = container.querySelector('[data-testid="spinner"]');
    expect(spinner?.className).toContain("size-8");
  });

  it("is always aria-hidden, regardless of size or className", () => {
    const { container: smContainer } = render(<Spinner size="sm" />);
    expect(smContainer.firstChild).toHaveAttribute("aria-hidden", "true");

    cleanup();

    const { container: customContainer } = render(<Spinner className="mt-2" />);
    expect(customContainer.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("does not let a consumer-supplied aria-hidden override the always-hidden invariant", () => {
    const { container } = render(<Spinner aria-hidden="false" />);

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("merges a custom className with the base classes", () => {
    const { container } = render(<Spinner className="mt-2" data-testid="spinner" />);

    const spinner = container.querySelector('[data-testid="spinner"]');
    expect(spinner?.className).toContain("relative");
    expect(spinner?.className).toContain("mt-2");
  });

  it("renders 4 phase-offset squares", () => {
    const { container } = render(<Spinner />);

    expect(container.querySelectorAll(".animate-square-pulse")).toHaveLength(4);
  });
});
