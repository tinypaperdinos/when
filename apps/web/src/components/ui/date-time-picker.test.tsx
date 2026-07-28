import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import {
  DateTimePicker,
  type DateTimePickerProps,
  type DateTimePickerValue,
} from "./date-time-picker";

afterEach(() => {
  cleanup();
});

function ControlledDateTimePicker(
  props: Omit<DateTimePickerProps, "value" | "onChange"> & {
    initialValue: DateTimePickerValue;
  },
) {
  const { initialValue, ...rest } = props;
  const [value, setValue] = useState<DateTimePickerValue>(initialValue);
  return <DateTimePicker value={value} onChange={setValue} {...rest} />;
}

describe("DateTimePicker", () => {
  it("renders the date field's trigger showing a muted placeholder and the unchecked 'Add time' checkbox, with no time input in the DOM by default", () => {
    render(<DateTimePicker value={{ date: "" }} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent("Select a date");
    expect(screen.getByLabelText("Add time")).not.toBeChecked();
    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
  });

  it("calls onChange with time: '' when checking 'Add time'", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value={{ date: "2026-07-26" }} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Add time"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ date: "2026-07-26", time: "" });
  });

  it("calls onChange with an absent time key when unchecking 'Add time'", () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker value={{ date: "2026-07-26", time: "14:30" }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByLabelText("Add time"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ date: "2026-07-26" });
    const result = onChange.mock.calls[0][0] as DateTimePickerValue;
    expect(result.time).toBeUndefined();
  });

  it("shows the checked toggle and populated time input when mounted with a defined time, without requiring interaction first", () => {
    render(
      <DateTimePicker value={{ date: "2026-07-26", time: "14:30" }} onChange={() => {}} />,
    );

    expect(screen.getByLabelText("Add time")).toBeChecked();
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("14:30");
  });

  it("picking a new date preserves the previous time (including the no-time case)", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value={{ date: "2026-07-26" }} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "27" }));

    expect(onChange).toHaveBeenCalledWith({ date: "2026-07-27" });
  });

  it("picking a new date preserves an already-set time", () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker value={{ date: "2026-07-26", time: "09:00" }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "27" }));

    expect(onChange).toHaveBeenCalledWith({ date: "2026-07-27", time: "09:00" });
  });

  it("changing the time input preserves the previous date", () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker value={{ date: "2026-07-26", time: "09:00" }} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:15" } });

    expect(onChange).toHaveBeenCalledWith({ date: "2026-07-26", time: "10:15" });
  });

  it("with timeOptional=false, never renders the toggle and always renders the time input, even with no time chosen", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value={{ date: "" }} onChange={onChange} timeOptional={false} />);

    expect(screen.queryByLabelText("Add time")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("");

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "08:00" } });

    expect(onChange).toHaveBeenCalledWith({ date: "", time: "08:00" });
  });

  it("uses custom dateLabel/timeLabel/addTimeLabel and does not also render the defaults", () => {
    render(
      <DateTimePicker
        value={{ date: "", time: "" }}
        onChange={() => {}}
        dateLabel="Custom date"
        timeLabel="Custom time"
        addTimeLabel="Custom add time"
      />,
    );

    expect(screen.getByLabelText("Custom date")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom time")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom add time")).toBeInTheDocument();

    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add time")).not.toBeInTheDocument();
  });

  it("disables the date field's trigger, time input, and checkbox, and blocks changes to each when disabled", () => {
    // `onChange` is a no-op here (doesn't feed back into `value`), so a controlled
    // input/checkbox that ignores an attempted change re-renders with its original
    // value — same assertion style `TextInput`/`Select`'s own disabled tests use, since
    // `fireEvent.change`/`fireEvent.click` dispatch events directly and aren't blocked by
    // the native `disabled` attribute the way a real trusted user interaction would be.
    const onChange = vi.fn();
    render(
      <DateTimePicker
        value={{ date: "2026-07-26", time: "09:00" }}
        onChange={onChange}
        disabled
      />,
    );

    const dateTrigger = screen.getByRole("button", { name: "Date" });
    const timeInput = screen.getByLabelText("Time") as HTMLInputElement;
    const toggle = screen.getByLabelText("Add time") as HTMLInputElement;

    expect(dateTrigger).toBeDisabled();
    expect(timeInput).toBeDisabled();
    expect(toggle).toBeDisabled();

    fireEvent.click(dateTrigger);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();

    fireEvent.change(timeInput, { target: { value: "10:00" } });
    fireEvent.click(toggle);

    expect(dateTrigger).toHaveTextContent("Jul 26, 2026");
    expect(timeInput.value).toBe("09:00");
    expect(toggle.checked).toBe(true);
  });

  it("minDate: day cells before it render aria-disabled and are unclickable (enforced in JS, not a native min attribute)", () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker
        value={{ date: "2026-07-15" }}
        onChange={onChange}
        minDate="2026-07-10"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Date" }));

    const day5 = screen.getByRole("gridcell", { name: "5" });
    expect(day5).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(day5);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("merges a consumer-supplied className onto the wrapping div", () => {
    const { container } = render(
      <DateTimePicker value={{ date: "" }} onChange={() => {}} className="custom-class" />,
    );

    expect(container.firstElementChild?.className).toContain("custom-class");
  });

  it("renders without throwing given only the minimum required props", () => {
    expect(() =>
      render(<DateTimePicker value={{ date: "" }} onChange={() => {}} />),
    ).not.toThrow();
  });

  it("stays controlled end-to-end when driven by external state", () => {
    render(<ControlledDateTimePicker initialValue={{ date: "2026-09-01" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "10" }));
    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent("Sep 10, 2026");

    fireEvent.click(screen.getByLabelText("Add time"));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "12:00" } });
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("12:00");
  });
});
