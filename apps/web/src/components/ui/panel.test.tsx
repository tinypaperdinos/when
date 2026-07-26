import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Panel, type PanelPadding } from "./panel";

afterEach(() => {
  cleanup();
});

describe("Panel", () => {
  it("renders the header block when both title and description are given", () => {
    render(
      <Panel title="Task details" description="Edit the task below">
        body
      </Panel>,
    );

    expect(
      screen.getByRole("heading", { name: "Task details", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Edit the task below")).toBeInTheDocument();
  });

  it("renders the header block when only title is given", () => {
    render(<Panel title="Task details">body</Panel>);

    expect(
      screen.getByRole("heading", { name: "Task details", level: 3 }),
    ).toBeInTheDocument();
  });

  it("renders the header block when only description is given", () => {
    render(<Panel description="Edit the task below">body</Panel>);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Edit the task below")).toBeInTheDocument();
  });

  it("renders no header block when neither title nor description is given", () => {
    const { container } = render(<Panel>body</Panel>);

    expect(container.querySelector(".border-b-2")).not.toBeInTheDocument();
  });

  it("exposes a region role with the title as its accessible name when title is given", () => {
    render(<Panel title="Task details">body</Panel>);

    expect(screen.getByRole("region", { name: "Task details" })).toBeInTheDocument();
  });

  it("does not expose a region role when only description is given", () => {
    render(<Panel description="Edit the task below">body</Panel>);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  const paddings: PanelPadding[] = ["md", "lg"];
  for (const padding of paddings) {
    it(`renders the ${padding} padding class`, () => {
      render(
        <Panel padding={padding} data-testid="panel">
          body
        </Panel>,
      );

      const panel = screen.getByTestId("panel");
      expect(panel.className).toContain(padding === "md" ? "p-4" : "p-6");
    });
  }

  it("defaults to lg padding when padding is omitted", () => {
    render(<Panel data-testid="panel">body</Panel>);

    expect(screen.getByTestId("panel").className).toContain("p-6");
  });

  it("merges a custom className with the base classes", () => {
    render(
      <Panel className="mt-2" data-testid="panel">
        body
      </Panel>,
    );

    const panel = screen.getByTestId("panel");
    expect(panel.className).toContain("border-ink");
    expect(panel.className).toContain("mt-2");
  });

  it("forwards arbitrary native props via spread", () => {
    render(
      <Panel data-testid="panel" id="panel-id">
        body
      </Panel>,
    );

    expect(screen.getByTestId("panel")).toHaveAttribute("id", "panel-id");
  });

  it("renders with no title, no description, and zero children without throwing", () => {
    const { container } = render(<Panel data-testid="panel" />);

    expect(screen.getByTestId("panel")).toBeInTheDocument();
    expect(container.querySelector(".border-b-2")).not.toBeInTheDocument();
  });
});
