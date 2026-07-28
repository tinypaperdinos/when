import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { UiDemoPage } from "./ui-demo-page";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

  it("shows the Select demo block with placeholder, defaultValue, and controlled examples", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "Select", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a tag" })).toHaveTextContent(
      "Choose a tag…",
    );
    expect(screen.getByRole("button", { name: "Choose a priority" })).toHaveTextContent("High");
  });

  it("shows the controlled Select demo example and is genuinely interactive", () => {
    render(<UiDemoPage />);

    const trigger = screen.getByRole("button", { name: "Choose a fruit" });
    expect(trigger).toHaveTextContent("Choose a fruit…");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Banana" }));

    expect(trigger).toHaveTextContent("Banana");
  });

  it("shows the DateTimePicker demo block and is genuinely interactive (toggle + calendar popup update what's shown)", () => {
    render(<UiDemoPage />);

    expect(
      screen.getByRole("heading", { name: "DateTimePicker", level: 2 }),
    ).toBeInTheDocument();

    // Two examples both use the default "Date" aria-label: the first (default
    // timeOptional, starts with no time) and the second (timeOptional=false, both
    // fields always shown). Only the second has a "Time" input before any interaction,
    // since the first's time field is hidden until "Add time" is checked.
    const dateTriggers = screen.getAllByRole("button", { name: "Date" });
    expect(dateTriggers).toHaveLength(2);
    expect(screen.getAllByLabelText("Time")).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Add time"));
    expect(screen.getAllByLabelText("Time")).toHaveLength(2);

    fireEvent.click(dateTriggers[0]);
    fireEvent.click(screen.getByRole("gridcell", { name: "1" }));
    expect(dateTriggers[0]).not.toHaveTextContent("Select a date");

    const timeInputs = screen.getAllByLabelText("Time") as HTMLInputElement[];
    fireEvent.change(timeInputs[1], { target: { value: "09:30" } });
    expect(timeInputs[1].value).toBe("09:30");
  });

  it("shows the DateRangePicker demo block seeded with a start date and reflects changes via onChange", () => {
    // The end date starts empty, so its calendar's default view falls back to "today" —
    // fixed here so it reliably lands on the same July 2026 month as the seeded start
    // date, letting this test assert the minDate guardrail without a month-nav detour.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28));

    render(<UiDemoPage />);

    expect(
      screen.getByRole("heading", { name: "DateRangePicker", level: 2 }),
    ).toBeInTheDocument();

    const startTrigger = screen.getByRole("button", { name: "Start date" });
    const endTrigger = screen.getByRole("button", { name: "End date" });

    expect(startTrigger).toHaveTextContent("Jul 26, 2026");

    fireEvent.click(endTrigger);
    expect(screen.getByRole("gridcell", { name: "25" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("gridcell", { name: "26" })).not.toHaveAttribute("aria-disabled");
    fireEvent.keyDown(endTrigger, { key: "Escape" });

    fireEvent.click(startTrigger);
    fireEvent.click(screen.getByRole("gridcell", { name: "1" }));
    expect(startTrigger).toHaveTextContent("Jul 1, 2026");

    fireEvent.click(endTrigger);
    expect(screen.getByRole("gridcell", { name: "1" })).not.toHaveAttribute("aria-disabled");
  });

  it("shows the Badge demo block with each variant's hashtag-styled sample text", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "Badge", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("pop:")).toBeInTheDocument();
    expect(screen.getByText("#backend")).toBeInTheDocument();
    expect(screen.getByText("accent:")).toBeInTheDocument();
    expect(screen.getByText("#personal")).toBeInTheDocument();
    expect(screen.getByText("neutral:")).toBeInTheDocument();
    expect(screen.getByText("#urgent")).toBeInTheDocument();
  });

  it("shows the TagInput demo block and is genuinely interactive (seeded, freeform, and disabled examples)", () => {
    render(<UiDemoPage />);

    expect(screen.getByRole("heading", { name: "TagInput", level: 2 })).toBeInTheDocument();

    // Seeded example: existing chips reachable via their remove-button accessible name.
    expect(screen.getByRole("button", { name: "Remove work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove urgent" })).toBeInTheDocument();

    // Typing into the seeded example's input surfaces a matching, not-already-selected
    // suggestion as a reachable option.
    const seededInput = screen.getByLabelText("Tags") as HTMLInputElement;
    fireEvent.change(seededInput, { target: { value: "back" } });
    const backendOption = screen.getByRole("option", { name: "backend" });
    expect(backendOption).toBeInTheDocument();
    fireEvent.click(backendOption.querySelector("button") as HTMLButtonElement);
    expect(screen.getByRole("button", { name: "Remove backend" })).toBeInTheDocument();

    // Freeform example: no suggestions supplied, so typing never renders a listbox, even
    // for text that would otherwise match another example's suggestions.
    const freeformInput = screen.getByLabelText("Freeform tags") as HTMLInputElement;
    fireEvent.change(freeformInput, { target: { value: "work" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Disabled example: chips still render, but the remove button is disabled.
    const disabledInput = screen.getByLabelText("Disabled tags");
    expect(disabledInput).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove errand" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove frontend" })).toBeDisabled();
  });
});
