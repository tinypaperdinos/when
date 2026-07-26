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
  it("renders the date input empty and the unchecked 'Add time' checkbox, with no time input in the DOM by default", () => {
    render(<DateTimePicker value={{ date: "" }} onChange={() => {}} />);

    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("");
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

  it("changing the date input preserves the previous time (including the no-time case)", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value={{ date: "" }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-08-01" } });

    expect(onChange).toHaveBeenCalledWith({ date: "2026-08-01" });
  });

  it("changing the date input preserves an already-set time", () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker value={{ date: "2026-07-26", time: "09:00" }} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-08-01" } });

    expect(onChange).toHaveBeenCalledWith({ date: "2026-08-01", time: "09:00" });
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

  it("disables the date input, time input, and checkbox, and blocks changes to each when disabled", () => {
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

    const dateInput = screen.getByLabelText("Date") as HTMLInputElement;
    const timeInput = screen.getByLabelText("Time") as HTMLInputElement;
    const toggle = screen.getByLabelText("Add time") as HTMLInputElement;

    expect(dateInput).toBeDisabled();
    expect(timeInput).toBeDisabled();
    expect(toggle).toBeDisabled();

    fireEvent.change(dateInput, { target: { value: "2026-08-01" } });
    fireEvent.change(timeInput, { target: { value: "10:00" } });
    fireEvent.click(toggle);

    expect(dateInput.value).toBe("2026-07-26");
    expect(timeInput.value).toBe("09:00");
    expect(toggle.checked).toBe(true);
  });

  it("renders minDate as the date input's native min attribute", () => {
    render(
      <DateTimePicker value={{ date: "" }} onChange={() => {}} minDate="2026-07-01" />,
    );

    expect(screen.getByLabelText("Date")).toHaveAttribute("min", "2026-07-01");
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
    render(<ControlledDateTimePicker initialValue={{ date: "" }} />);

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-10" } });
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-09-10");

    fireEvent.click(screen.getByLabelText("Add time"));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "12:00" } });
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("12:00");
  });
});
