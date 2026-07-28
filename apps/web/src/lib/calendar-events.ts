import type { EventInput } from "@fullcalendar/core";
import type { Task, EventEntry } from "../trpc";

export type CalendarEntry = Task | EventEntry;

// A wire timestamp is treated as "no specific time" (rendered as an all-day calendar
// chip) exactly when its literal characters end in the fixed suffix "T00:00:00.000Z" —
// a plain string comparison against the raw wire value, deliberately NOT
// `new Date(iso).getUTCHours() === 0 && ...`. `list()` always serializes a `DateTime`
// column via `JSON.stringify`'s default `Date#toJSON` (no superjson transformer
// configured, per AGENT_RULES.md), which is always the fixed-width `toISOString()` shape
// `YYYY-MM-DDTHH:mm:ss.sssZ`, so the literal suffix is exactly as informative as
// re-parsing the string into a `Date` and reading UTC getters back off it. The string
// form is still the correct choice: it structurally cannot fall into the classic footgun
// of a typo'd *local* getter (`getHours()` instead of `getUTCHours()`), which would
// silently make the classification depend on the *browser's* timezone.
export function isMidnightUtc(iso: string): boolean {
  return iso.endsWith("T00:00:00.000Z");
}

// Converts one Entry row (task or event) into a FullCalendar EventInput, or null if it
// has nothing to place (a task with no dueDate — never true for events, whose `date` is
// required on create per event-crud plan §3.1, but the null check is defensive).
export function entryToCalendarEvent(entry: CalendarEntry): EventInput | null {
  const iso = entry.kind === "task" ? entry.dueDate : entry.date;
  if (!iso) return null;

  const allDay = isMidnightUtc(iso);

  return {
    id: entry.id,
    title: entry.title,
    // Sliced directly off the wire string's own characters rather than re-parsed via
    // `new Date(iso).getUTCFullYear()`/`getUTCMonth() + 1`/`getUTCDate()` — a literal-
    // character operation, not a re-parse, for the same reader-timezone-independence
    // reason as `isMidnightUtc` above.
    start: allDay ? iso.slice(0, 10) : iso,
    allDay,
    durationEditable: false,
    extendedProps: {
      kind: entry.kind,
      completed: entry.kind === "task" ? entry.completed : undefined,
    },
  };
}

// Merges tasks + events into one FullCalendar `events` array, dropping nulls.
export function calendarEntries(
  tasks: Task[] | undefined,
  events: EventEntry[] | undefined,
): EventInput[] {
  const taskEvents = (tasks ?? []).map(entryToCalendarEvent);
  const eventEvents = (events ?? []).map(entryToCalendarEvent);
  return [...taskEvents, ...eventEvents].filter((event): event is EventInput => event !== null);
}

// The inverse direction: a FullCalendar drop result -> a wireDateTimeString-compatible
// string, built from the dropped-to Date's *local* getters, zero-padded — never
// toISOString(). Getters used: `getFullYear()`, `getMonth() + 1` (note the `+ 1`
// explicitly: `getMonth()` is zero-indexed, Jan = `0` — a well-known JS footgun that's
// easy to get "digit-shaped but wrong," e.g. January silently becoming `"00"`, which is
// still valid against `wireDateTimeString`'s regex and silently wrong as a date),
// `getDate()`, `getHours()`, `getMinutes()`. This matters for both branches: for a timed
// drop, toISOString() would convert to UTC and shift the hour (and potentially the day,
// near midnight) in any non-UTC *browser* timezone; for an all-day drop, FullCalendar's
// own `event.start` for an all-day event is already anchored to *local* midnight of the
// intended calendar day, so local getters recover the right day exactly. This is a
// client-side/browser-timezone concern, orthogonal to the server-side timezone issue
// documented in tickets/calendar-view/plan.md §3.1 — `wireDateFromDrop` itself has no
// timezone bug; the string it hands off can still be misinterpreted one hop later,
// server-side, for the reasons documented there.
export function wireDateFromDrop(date: Date, allDay: boolean): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;

  if (allDay) return dateString;

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dateString}T${hours}:${minutes}`;
}

export type RescheduleMutationArgs =
  | { kind: "task"; payload: { id: string; dueDate: string } }
  | { kind: "event"; payload: { id: string; date: string } };

// Builds the mutation dispatch info for a drop, without calling any mutation itself —
// kept as a pure function here (rather than inline in CalendarPage's `handleEventDrop`)
// so the dispatch logic (which mutation, which payload shape) is unit-testable directly,
// per tickets/calendar-view/plan.md §3.4.
export function buildRescheduleMutationArgs(
  id: string,
  kind: "task" | "event",
  date: Date,
  allDay: boolean,
): RescheduleMutationArgs {
  const wireDate = wireDateFromDrop(date, allDay);
  return kind === "task"
    ? { kind: "task", payload: { id, dueDate: wireDate } }
    : { kind: "event", payload: { id, date: wireDate } };
}
