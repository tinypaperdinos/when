import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { CalendarPopup } from "./calendar-popup";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CalendarPopup", () => {
  it("renders the trigger showing a muted placeholder when value is empty", () => {
    render(<CalendarPopup value="" onChange={() => {}} aria-label="Due date" />);

    const trigger = screen.getByRole("button", { name: "Due date" });
    expect(trigger).toHaveTextContent("Select a date");
    expect(trigger.querySelector("span")?.className).toContain("text-ink/40");
  });

  it("renders the trigger showing the formatted value when non-empty", () => {
    render(
      <CalendarPopup value="2026-07-08" onChange={() => {}} aria-label="Due date" />,
    );

    expect(screen.getByRole("button", { name: "Due date" })).toHaveTextContent(
      "Jul 8, 2026",
    );
  });

  it("opening the popup shows the correct month/year header and in-month day-cell count, including a leap-February case", () => {
    render(
      <CalendarPopup value="2028-02-01" onChange={() => {}} aria-label="Due date" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));

    expect(screen.getByText("February 2028")).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(29);
  });

  it("a non-leap February renders 28 in-month day cells", () => {
    render(
      <CalendarPopup value="2026-02-01" onChange={() => {}} aria-label="Due date" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));

    expect(screen.getAllByRole("gridcell")).toHaveLength(28);
  });

  it("the first day cell aligns under the correct weekday column (July 2026 starts on a Wednesday)", () => {
    render(
      <CalendarPopup value="2026-07-08" onChange={() => {}} aria-label="Due date" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));

    const firstRow = screen.getAllByRole("row")[0];
    const cellsInFirstRow = within(firstRow).queryAllByRole("gridcell");
    // 3 leading blank (non-gridcell) cells, so day 1 is the 4th cell in the row.
    expect(cellsInFirstRow).toHaveLength(4);
    expect(cellsInFirstRow[0]).toHaveTextContent("1");
  });

  it("leading/trailing padding cells pad the grid to a multiple of 7 but are not interactive gridcells", () => {
    render(
      <CalendarPopup value="2026-07-08" onChange={() => {}} aria-label="Due date" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));

    const rows = screen.getAllByRole("row");
    // July 2026: 3 leading blanks + 31 days = 34, padded to 35 = 5 rows of 7.
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.children).toHaveLength(7);
    }
    expect(screen.getAllByRole("gridcell")).toHaveLength(31);
  });

  it("clicking an in-month day calls onChange with the exact zero-padded YYYY-MM-DD string and closes the popup", () => {
    const onChange = vi.fn();
    render(
      <CalendarPopup value="2026-03-01" onChange={onChange} aria-label="Due date" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "5" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-03-05");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("prev/next month buttons re-render the grid for the adjacent month without calling onChange, including across a year boundary", () => {
    const onChange = vi.fn();
    render(
      <CalendarPopup value="2026-12-15" onChange={onChange} aria-label="Due date" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));
    expect(screen.getByText("December 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("January 2027")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("November 2026")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("minDate: day cells before it are aria-disabled and unclickable; the boundary day itself is not disabled", () => {
    const onChange = vi.fn();
    render(
      <CalendarPopup
        value="2026-07-15"
        onChange={onChange}
        minDate="2026-07-10"
        aria-label="Due date"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));

    const day5 = screen.getByRole("gridcell", { name: "5" });
    expect(day5).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(day5);
    expect(onChange).not.toHaveBeenCalled();

    const day10 = screen.getByRole("gridcell", { name: "10" });
    expect(day10).not.toHaveAttribute("aria-disabled");
    fireEvent.click(day10);
    expect(onChange).toHaveBeenCalledWith("2026-07-10");
  });

  it("minDate: disabled days are skipped by arrow-key navigation, clamping at the boundary day", () => {
    render(
      <CalendarPopup
        value="2026-07-15"
        onChange={() => {}}
        minDate="2026-07-10"
        aria-label="Due date"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    fireEvent.click(trigger); // opens, highlights day 15 (the current value)

    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(trigger, { key: "ArrowLeft" });
    }

    const day10 = screen.getByRole("gridcell", { name: "10" });
    expect(trigger).toHaveAttribute("aria-activedescendant", day10.id);

    // One more ArrowLeft: day 9 and below are all disabled, so this clamps back at 10.
    fireEvent.keyDown(trigger, { key: "ArrowLeft" });
    expect(trigger).toHaveAttribute("aria-activedescendant", day10.id);
  });

  it("keyboard: arrow keys move the highlighted day via aria-activedescendant on the trigger (real DOM focus never leaves the trigger), clamped at month edges", () => {
    render(
      <CalendarPopup value="2026-07-08" onChange={() => {}} aria-label="Due date" />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    fireEvent.click(trigger); // opens, highlights day 8 (the current value)
    // jsdom's fireEvent.click doesn't simulate the browser's real focus-shift-on-click
    // default action, so focus is set explicitly here to establish the starting
    // condition this test actually cares about: that none of the subsequent keydown
    // interactions ever move focus onto a day cell.
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    let day9 = screen.getByRole("gridcell", { name: "9" });
    expect(trigger).toHaveAttribute("aria-activedescendant", day9.id);
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // +7 days: 9 -> 16
    const day16 = screen.getByRole("gridcell", { name: "16" });
    expect(trigger).toHaveAttribute("aria-activedescendant", day16.id);

    fireEvent.keyDown(trigger, { key: "ArrowUp" }); // -7 days: 16 -> 9
    day9 = screen.getByRole("gridcell", { name: "9" });
    expect(trigger).toHaveAttribute("aria-activedescendant", day9.id);
    expect(document.activeElement).toBe(trigger);
  });

  it("Enter selects the highlighted day and closes the popup", () => {
    const onChange = vi.fn();
    render(
      <CalendarPopup value="2026-07-08" onChange={onChange} aria-label="Due date" />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-07-09");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("Escape closes the popup without calling onChange", () => {
    const onChange = vi.fn();
    render(
      <CalendarPopup value="2026-07-08" onChange={onChange} aria-label="Due date" />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    fireEvent.click(trigger);
    expect(screen.getByRole("grid")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("every rendered day-cell button (in-month, disabled alike) has tabIndex={-1}, and padding cells are not gridcells at all", () => {
    render(
      <CalendarPopup
        value="2026-07-15"
        onChange={() => {}}
        minDate="2026-07-10"
        aria-label="Due date"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));

    for (const cell of screen.getAllByRole("gridcell")) {
      expect(cell).toHaveAttribute("tabindex", "-1");
    }

    const firstRow = screen.getAllByRole("row")[0];
    // July 2026's leading blank cells render, but not as role="gridcell".
    expect(firstRow.children.length).toBeGreaterThan(
      within(firstRow).queryAllByRole("gridcell").length,
    );
  });

  it("disabled: the trigger cannot be opened via click or keyboard", () => {
    render(
      <CalendarPopup value="" onChange={() => {}} aria-label="Due date" disabled />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("today's date gets a distinguishing treatment independent of selection (fixed clock)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15));

    render(<CalendarPopup value="" onChange={() => {}} aria-label="Due date" />);

    fireEvent.click(screen.getByRole("button", { name: "Due date" }));

    const today = screen.getByRole("gridcell", { name: "15" });
    expect(today).toHaveAttribute("aria-selected", "false");
    expect(today.className).toContain("border-dashed");
  });

  it("forwards aria-label and id onto the trigger", () => {
    render(
      <CalendarPopup value="" onChange={() => {}} aria-label="Due date" id="due-date" />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    expect(trigger).toHaveAttribute("id", "due-date");
  });

  it("renders without throwing given value=\"\" and a no-op onChange", () => {
    expect(() =>
      render(<CalendarPopup value="" onChange={() => {}} />),
    ).not.toThrow();
  });
});
