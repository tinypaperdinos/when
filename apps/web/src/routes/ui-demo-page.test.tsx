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

  it("shows the Button icon variant demo block with an accessible name per size", () => {
    render(<UiDemoPage />);

    expect(
      screen.getByRole("heading", { name: "Button — icon variant", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove item" })).toBeInTheDocument();
  });

  it("shows icon + label combined via the existing secondary variant, no dedicated variant needed", () => {
    render(<UiDemoPage />);

    expect(
      screen.getByRole("button", { name: "Add item to list" }),
    ).toBeInTheDocument();
  });

  it("shows the TextInput demo block with sm/md sizes and a disabled example", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "TextInput", level: 2 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("sm input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("md input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("disabled input")).toBeDisabled();
  });

  it("shows the Textarea demo block with placeholder and multi-line default content", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "Textarea", level: 2 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Notes…")).toHaveValue("First line\nSecond line");
  });

  it("shows the Checkbox demo block with unchecked, checked, and disabled examples", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "Checkbox", level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText("Unchecked example")).not.toBeChecked();
    expect(screen.getByLabelText("Checked by default")).toBeChecked();
    expect(screen.getByLabelText("Disabled example")).toBeDisabled();
  });

  it("shows the Select demo block with a placeholder example and a defaultValue example", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "Select", level: 2 })).toBeInTheDocument();
    expect((screen.getByLabelText("Choose a tag") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Choose a priority") as HTMLSelectElement).value).toBe(
      "high",
    );
  });
});
