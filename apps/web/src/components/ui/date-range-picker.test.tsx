import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";

afterEach(() => {
  cleanup();
});

const emptyRange: DateRangeValue = {
  start: { date: "" },
  end: { date: "" },
};

function ControlledDateRangePicker(
  props: Omit<ComponentProps<typeof DateRangePicker>, "value" | "onChange"> & {
    initialValue: DateRangeValue;
  },
) {
  const { initialValue, ...rest } = props;
  const [value, setValue] = useState<DateRangeValue>(initialValue);
  return <DateRangePicker value={value} onChange={setValue} {...rest} />;
}

describe("DateRangePicker", () => {
  it("renders two fieldsets with default 'Start'/'End' legends", () => {
    render(<DateRangePicker value={emptyRange} onChange={() => {}} />);

    expect(screen.getByRole("group", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "End" })).toBeInTheDocument();
  });

  it("defaults timeOptional to false: no 'Add time' toggle on either side, both time inputs always shown", () => {
    render(<DateRangePicker value={emptyRange} onChange={() => {}} />);

    expect(screen.queryByLabelText("Add start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add end time")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(screen.getByLabelText("End time")).toBeInTheDocument();
  });

  it("with timeOptional=true, shows both toggles and toggling one side does not affect the other", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker value={emptyRange} onChange={onChange} timeOptional />,
    );

    fireEvent.click(screen.getByLabelText("Add start time"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0] as DateRangeValue;
    expect(result.start.time).toBe("");
    expect(result.end.time).toBeUndefined();
  });

  it("regression: the two 'Add time' toggles have distinct default text and the shared 'Add time' default is never rendered", () => {
    render(<DateRangePicker value={emptyRange} onChange={() => {}} timeOptional />);

    expect(screen.getByLabelText("Add start time")).toBeInTheDocument();
    expect(screen.getByLabelText("Add end time")).toBeInTheDocument();
    expect(screen.getByLabelText("Add start time")).not.toBe(
      screen.getByLabelText("Add end time"),
    );
    expect(screen.queryByLabelText("Add time")).not.toBeInTheDocument();
    expect(screen.queryByText("Add time")).not.toBeInTheDocument();
  });

  it("exposes the composed default date/time labels", () => {
    render(<DateRangePicker value={emptyRange} onChange={() => {}} />);

    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
    expect(screen.getByLabelText("End time")).toBeInTheDocument();
  });

  it("changing the start date updates value.start and leaves value.end unchanged", () => {
    const onChange = vi.fn();
    const value: DateRangeValue = {
      start: { date: "2026-07-01" },
      end: { date: "2026-07-05" },
    };
    render(<DateRangePicker value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-07-02" },
    });

    expect(onChange).toHaveBeenCalledWith({
      start: { date: "2026-07-02" },
      end: { date: "2026-07-05" },
    });
  });

  it("changing the end date updates value.end and leaves value.start unchanged", () => {
    const onChange = vi.fn();
    const value: DateRangeValue = {
      start: { date: "2026-07-01" },
      end: { date: "2026-07-05" },
    };
    render(<DateRangePicker value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-07-06" },
    });

    expect(onChange).toHaveBeenCalledWith({
      start: { date: "2026-07-01" },
      end: { date: "2026-07-06" },
    });
  });

  it("sets the end date input's min to the current start date when non-empty", () => {
    const value: DateRangeValue = {
      start: { date: "2026-07-01" },
      end: { date: "" },
    };
    render(<DateRangePicker value={value} onChange={() => {}} />);

    expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2026-07-01");
  });

  it("leaves the end date input's min absent (not min='') when the start date is empty", () => {
    render(<DateRangePicker value={emptyRange} onChange={() => {}} />);

    expect(screen.getByLabelText("End date")).not.toHaveAttribute("min");
  });

  it("updates the end date's min when the start date changes on re-render", () => {
    const value: DateRangeValue = {
      start: { date: "2026-07-01" },
      end: { date: "" },
    };
    const { rerender } = render(<DateRangePicker value={value} onChange={() => {}} />);

    expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2026-07-01");

    rerender(
      <DateRangePicker
        value={{ start: { date: "2026-07-15" }, end: { date: "" } }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2026-07-15");
  });

  it("propagates startLabel/endLabel overrides into legends and all three composed labels per side", () => {
    // `time` set (not undefined) on both sides so the time inputs actually render under
    // `timeOptional` — otherwise the "Departs time"/"Returns time" queries below would
    // find nothing, independent of the label-composition logic under test.
    const value: DateRangeValue = {
      start: { date: "", time: "" },
      end: { date: "", time: "" },
    };
    render(
      <DateRangePicker
        value={value}
        onChange={() => {}}
        timeOptional
        startLabel="Departs"
        endLabel="Returns"
      />,
    );

    expect(screen.getByRole("group", { name: "Departs" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Returns" })).toBeInTheDocument();
    expect(screen.getByLabelText("Departs date")).toBeInTheDocument();
    expect(screen.getByLabelText("Departs time")).toBeInTheDocument();
    expect(screen.getByLabelText("Add departs time")).toBeInTheDocument();
    expect(screen.getByLabelText("Returns date")).toBeInTheDocument();
    expect(screen.getByLabelText("Returns time")).toBeInTheDocument();
    expect(screen.getByLabelText("Add returns time")).toBeInTheDocument();
  });

  it("disables every sub-control on both sides", () => {
    const value: DateRangeValue = {
      start: { date: "2026-07-01", time: "09:00" },
      end: { date: "2026-07-05", time: "10:00" },
    };
    render(<DateRangePicker value={value} onChange={() => {}} timeOptional disabled />);

    expect(screen.getByLabelText("Start date")).toBeDisabled();
    expect(screen.getByLabelText("Start time")).toBeDisabled();
    expect(screen.getByLabelText("Add start time")).toBeDisabled();
    expect(screen.getByLabelText("End date")).toBeDisabled();
    expect(screen.getByLabelText("End time")).toBeDisabled();
    expect(screen.getByLabelText("Add end time")).toBeDisabled();
  });

  it("merges a consumer-supplied className onto the outer wrapping div", () => {
    const { container } = render(
      <DateRangePicker value={emptyRange} onChange={() => {}} className="custom-class" />,
    );

    expect(container.firstElementChild?.className).toContain("custom-class");
  });

  it("renders without throwing given only the minimum required props", () => {
    expect(() =>
      render(<DateRangePicker value={emptyRange} onChange={() => {}} />),
    ).not.toThrow();
  });

  it("stays controlled end-to-end when driven by external state", () => {
    render(<ControlledDateRangePicker initialValue={emptyRange} />);

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-07-01" },
    });
    expect((screen.getByLabelText("Start date") as HTMLInputElement).value).toBe(
      "2026-07-01",
    );
    expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2026-07-01");
  });
});
