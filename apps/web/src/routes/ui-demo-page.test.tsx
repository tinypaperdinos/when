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
});
