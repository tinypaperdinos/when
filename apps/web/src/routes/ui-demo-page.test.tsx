import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UiDemoPage } from "./ui-demo-page";

afterEach(() => {
  cleanup();
});

describe("UiDemoPage", () => {
  it("renders without any router/query/tRPC context", () => {
    expect(() => render(<UiDemoPage />)).not.toThrow();
  });

  const combinations: [string, string][] = [
    ["primary", "sm"],
    ["primary", "md"],
    ["secondary", "sm"],
    ["secondary", "md"],
  ];

  for (const [variant, size] of combinations) {
    it(`shows the ${variant}/${size} Button variant with a distinguishing label`, () => {
      render(<UiDemoPage />);

      expect(screen.getByText(`${variant} / ${size}:`)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `${variant} ${size}` }),
      ).toBeInTheDocument();
    });
  }

  it("shows the Section demo block with titled and untitled examples", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "Section", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ new task" })).toBeInTheDocument();
    expect(screen.getByText("Untitled section content")).toBeInTheDocument();
  });

  const cardPaddings: ["sm" | "md"][] = [["sm"], ["md"]];

  for (const [padding] of cardPaddings) {
    it(`shows the ${padding} Card padding variant with a distinguishing label`, () => {
      render(<UiDemoPage />);

      expect(screen.getByText(`${padding}:`)).toBeInTheDocument();
      expect(screen.getByText(`${padding} padding card`)).toBeInTheDocument();
    });
  }

  it("shows the Panel demo block with all title/description combinations", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "Panel", level: 2 })).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Task details", level: 3 }),
    ).toHaveLength(2);
    expect(screen.getByText("Edit the task below")).toBeInTheDocument();
    expect(screen.getAllByText("Panel body content")).toHaveLength(3);
  });
});
