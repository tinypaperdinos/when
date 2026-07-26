import { cn } from "../../lib/cn";
import { DateTimePicker, type DateTimePickerValue } from "./date-time-picker";

export interface DateRangeValue {
  start: DateTimePickerValue;
  end: DateTimePickerValue;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  // default false: an event's date/time is not optional per the Entry schema's own
  // comment ("event only: date/time"), unlike a task's dueDate; overridable if a future
  // consumer disagrees
  timeOptional?: boolean;
  startLabel?: string; // default "Start"
  endLabel?: string; // default "End"
  disabled?: boolean;
  className?: string;
}

// Controlled-only, built by composing two `DateTimePicker`s — see that component's doc
// comment and `components/ui/README.md` for why this whole composite family deviates
// from the controlled-or-uncontrolled pattern the rest of `components/ui/` follows.
export function DateRangePicker({
  value,
  onChange,
  timeOptional = false,
  startLabel,
  endLabel,
  disabled,
  className,
}: DateRangePickerProps) {
  const resolvedStartLabel = startLabel ?? "Start";
  const resolvedEndLabel = endLabel ?? "End";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="text-sm font-medium">{resolvedStartLabel}</legend>
        <DateTimePicker
          value={value.start}
          onChange={(start) => onChange({ ...value, start })}
          timeOptional={timeOptional}
          dateLabel={`${resolvedStartLabel} date`}
          timeLabel={`${resolvedStartLabel} time`}
          addTimeLabel={`Add ${resolvedStartLabel.toLowerCase()} time`}
          disabled={disabled}
        />
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="text-sm font-medium">{resolvedEndLabel}</legend>
        <DateTimePicker
          value={value.end}
          onChange={(end) => onChange({ ...value, end })}
          timeOptional={timeOptional}
          dateLabel={`${resolvedEndLabel} date`}
          timeLabel={`${resolvedEndLabel} time`}
          addTimeLabel={`Add ${resolvedEndLabel.toLowerCase()} time`}
          minDate={value.start.date || undefined}
          disabled={disabled}
        />
      </fieldset>
    </div>
  );
}
