import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Section } from "./section";

afterEach(() => {
  cleanup();
});

describe("Section", () => {
  it("renders both title and actions in a header row", () => {
    render(
      <Section title="Today" actions={<button type="button">+ new task</button>}>
        content
      </Section>,
    );

    expect(screen.getByRole("heading", { name: "Today", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ new task" })).toBeInTheDocument();
  });

  it("renders with only title", () => {
    render(<Section title="Today">content</Section>);

    expect(screen.getByRole("heading", { name: "Today", level: 2 })).toBeInTheDocument();
  });

  it("renders with only actions", () => {
    render(
      <Section actions={<button type="button">+ new task</button>}>content</Section>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ new task" })).toBeInTheDocument();
  });

  it("renders no header markup when neither title nor actions is given", () => {
    const { container } = render(<Section>content</Section>);

    expect(
      container.querySelector(".flex.items-center.justify-between"),
    ).not.toBeInTheDocument();
  });

  it("exposes a region role with the title as its accessible name", () => {
    render(<Section title="Today">content</Section>);

    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
  });

  it("has no aria-labelledby when no title is given", () => {
    const { container } = render(<Section>content</Section>);

    const section = container.querySelector("section");
    expect(section).not.toHaveAttribute("aria-labelledby");
  });

  it("appends a custom className alongside the base space-y-3 class", () => {
    const { container } = render(<Section className="mt-4">content</Section>);

    const section = container.querySelector("section");
    expect(section?.className).toContain("space-y-3");
    expect(section?.className).toContain("mt-4");
  });

  it("forwards arbitrary native props via spread", () => {
    render(
      <Section data-testid="my-section" id="section-id">
        content
      </Section>,
    );

    const section = screen.getByTestId("my-section");
    expect(section).toHaveAttribute("id", "section-id");
  });

  it("renders with no title, no actions, and zero children without throwing", () => {
    const { container } = render(<Section />);

    expect(
      container.querySelector(".flex.items-center.justify-between"),
    ).not.toBeInTheDocument();
  });
});
