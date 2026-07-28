import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LoadingState } from "./loading-state";

afterEach(() => {
  cleanup();
});

describe("LoadingState", () => {
  it("renders the default label when label is omitted", () => {
    render(<LoadingState />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders a custom label when supplied, overriding the default", () => {
    render(<LoadingState label="Loading tasks…" />);

    expect(screen.getByText("Loading tasks…")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("exposes role=status and aria-live=polite on the root element", () => {
    render(<LoadingState label="Loading tasks…" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Loading tasks…");
  });

  it("forwards size to the underlying Spinner", () => {
    const { container } = render(<LoadingState size="sm" />);

    const spinner = container.querySelector(".relative");
    expect(spinner?.className).toContain("size-6");
  });

  it("merges a custom className with the base classes", () => {
    render(<LoadingState className="mt-2" />);

    expect(screen.getByRole("status").className).toContain("mt-2");
  });
});
