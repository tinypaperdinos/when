import { cn } from "../../lib/cn";
import { TextInput } from "./text-input";
import { Checkbox } from "./checkbox";

export interface DateTimePickerValue {
  date: string; // native input[type=date] value: "" | "YYYY-MM-DD"
  time?: string; // native input[type=time] value: "HH:mm"; undefined = no time chosen
}

export interface DateTimePickerProps {
  value: DateTimePickerValue;
  onChange: (value: DateTimePickerValue) => void;
  // default true: shows an "Add time" toggle; when false, the time field is always
  // shown and the toggle is omitted
  timeOptional?: boolean;
  dateLabel?: string; // default "Date" — aria-label for the date input
  timeLabel?: string; // default "Time" — aria-label for the time input
  addTimeLabel?: string; // default "Add time" — label for the toggle checkbox
  minDate?: string; // native `min` attribute on the date input
  disabled?: boolean;
  className?: string; // applied to the wrapping <div>
}

// Controlled-only, unlike every other primitive in this directory (no `defaultValue`) —
// a deliberate deviation, not an oversight. See `components/ui/README.md` and
// `tickets/date-time-picker/plan.md` §2.4 for the reasoning: this is a composite of two
// native inputs plus derived, non-native "is the time field shown" UI state, so there's
// no single native element whose own `defaultValue` this could delegate to, and
// reconciling internal state against an optionally-controlled external `value` for a
// composite molecule isn't worth taking on for a "convenience" uncontrolled mode.
export function DateTimePicker({
  value,
  onChange,
  timeOptional = true,
  dateLabel,
  timeLabel,
  addTimeLabel,
  minDate,
  disabled,
  className,
}: DateTimePickerProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <TextInput
        type="date"
        aria-label={dateLabel ?? "Date"}
        value={value.date}
        min={minDate}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, date: e.target.value })}
      />
      {timeOptional !== false && (
        <Checkbox
          label={addTimeLabel ?? "Add time"}
          checked={value.time !== undefined}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.checked) {
              onChange({ ...value, time: value.time ?? "" });
            } else {
              // Rebuilt without a `time` key, rather than rest-destructuring it off —
              // `undefined`-as-a-present-key vs. key-absent are observably different
              // (e.g. `"time" in value`), and this keeps the "field doesn't exist right
              // now" representation clean without an unused-var destructure target.
              onChange({ date: value.date });
            }
          }}
        />
      )}
      {(timeOptional === false || value.time !== undefined) && (
        <TextInput
          type="time"
          aria-label={timeLabel ?? "Time"}
          value={value.time ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
        />
      )}
    </div>
  );
}
