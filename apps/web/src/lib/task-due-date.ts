import type { DateTimePickerValue } from "../components/ui/date-time-picker";

// Only the create-direction conversion is needed by this ticket's UI (a
// `DateTimePickerValue` -> the wire-string `dueDate` payload); the reverse
// direction (wire string back to a `DateTimePickerValue`, to pre-fill an
// editable field) isn't needed since due-date editing isn't wired to the UI
// this round (see tickets/task-crud/plan.md §3.10).
export function dueDatePayload(value: DateTimePickerValue): string | undefined {
  if (!value.date) return undefined;
  return value.time ? `${value.date}T${value.time}` : value.date;
}
