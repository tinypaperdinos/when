import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Badge, type BadgeVariant } from "./badge";

afterEach(() => {
  cleanup();
});

const variantClasses: Record<BadgeVariant, string> = {
  pop: "bg-pop",
  accent: "bg-accent",
  neutral: "bg-paper",
};

describe("Badge", () => {
  it("renders plain text children", () => {
    render(<Badge>#backend</Badge>);

    expect(screen.getByText("#backend")).toBeInTheDocument();
  });

  it("renders a composite of text plus a nested button, proving it works as TagInput's building block", () => {
    render(
      <Badge>
        work
        <button type="button" aria-label="Remove work">
          ×
        </button>
      </Badge>,
    );

    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove work" })).toBeInTheDocument();
  });

  for (const variant of Object.keys(variantClasses) as BadgeVariant[]) {
    it(`renders the ${variant} variant's documented background/text color classes`, () => {
      render(
        <Badge variant={variant} data-testid="badge">
          tag
        </Badge>,
      );

      const badge = screen.getByTestId("badge");
      expect(badge.className).toContain(variantClasses[variant]);
    });
  }

  it("defaults to the pop variant when variant is omitted", () => {
    render(<Badge data-testid="badge">tag</Badge>);

    expect(screen.getByTestId("badge").className).toContain("bg-pop");
  });

  it("merges a custom className with the base classes", () => {
    render(
      <Badge className="mt-2" data-testid="badge">
        tag
      </Badge>,
    );

    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("border-ink");
    expect(badge.className).toContain("mt-2");
  });

  it("forwards arbitrary native span attributes via spread", () => {
    render(
      <Badge data-testid="badge" id="badge-id" aria-label="a tag">
        tag
      </Badge>,
    );

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAttribute("id", "badge-id");
    expect(badge).toHaveAttribute("aria-label", "a tag");
  });

  it("renders without throwing given only children", () => {
    expect(() => render(<Badge>tag</Badge>)).not.toThrow();
  });
});
