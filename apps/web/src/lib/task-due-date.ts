import type { DateTimePickerValue } from "../components/ui/date-time-picker";

export function dueDatePayload(value: DateTimePickerValue): string | undefined {
  if (!value.date) return undefined;
  return value.time ? `${value.date}T${value.time}` : value.date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Inverse of dueDatePayload, for pre-filling the edit form from a wire dueDate. Takes
// `Date | string` since `Task["dueDate"]`'s inferred type is `Date` but the runtime
// value crossing the tRPC boundary is a string (see trpc.ts) — `new Date(...)` accepts
// either. Same "no part of this app handles timezones yet" caveat as dueDatePayload:
// round-trips exactly in UTC (this repo's dev/CI timezone), not guaranteed elsewhere.
export function dueDateValueFromWireDate(
  wireDueDate: string | Date | null | undefined,
): DateTimePickerValue {
  if (!wireDueDate) return { date: "" };
  const parsed = new Date(wireDueDate);
  const date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
  return hasTime ? { date, time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` } : { date };
}

// Update-direction payload: unlike dueDatePayload (create), an empty date here means
// "clear the due date" (null), not "omit the field" (undefined) — the edit form always
// resubmits its current due-date value, so there's no "leave unchanged" case to preserve.
export function dueDatePayloadForUpdate(value: DateTimePickerValue): string | null {
  return dueDatePayload(value) ?? null;
}

// Converts a JS Date + an explicit "was a time actually specified" flag into a wire
// dueDate string. Unlike dueDateValueFromWireDate's midnight-means-date-only heuristic
// (needed there because a wire string alone can't distinguish "no time" from
// "midnight"), quick-add has a real certainty signal from chrono, so hasTime is
// required rather than inferred.
export function wireDateTimeStringFromDate(date: Date, hasTime: boolean): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return hasTime ? `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}` : datePart;
}
