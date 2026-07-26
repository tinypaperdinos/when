import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Card, type CardPadding } from "./card";

afterEach(() => {
  cleanup();
});

const paddings: CardPadding[] = ["sm", "md"];

describe("Card", () => {
  for (const padding of paddings) {
    it(`renders the ${padding} padding class`, () => {
      render(
        <Card padding={padding} data-testid="card">
          {padding} content
        </Card>,
      );

      const card = screen.getByTestId("card");
      expect(card.className).toContain(padding === "sm" ? "p-3" : "p-4");
    });
  }

  it("defaults to md padding when padding is omitted", () => {
    render(<Card data-testid="card">content</Card>);

    expect(screen.getByTestId("card").className).toContain("p-4");
  });

  it("merges a custom className with the base classes", () => {
    render(
      <Card className="mt-2" data-testid="card">
        content
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card.className).toContain("border-ink");
    expect(card.className).toContain("mt-2");
  });

  it("renders with zero children without throwing", () => {
    expect(() => render(<Card data-testid="card" />)).not.toThrow();
    expect(screen.getByTestId("card")).toBeInTheDocument();
  });

  it("forwards arbitrary native props via spread", () => {
    render(
      <Card data-testid="card" id="card-id">
        content
      </Card>,
    );

    expect(screen.getByTestId("card")).toHaveAttribute("id", "card-id");
  });
});
