import type { EventInput } from "@fullcalendar/core";
import type { Task, EventEntry } from "../trpc";

export type CalendarEntry = Task | EventEntry;

// Deliberately a literal string comparison, not `new Date(iso).getUTCHours() === 0`,
// so classification can't accidentally depend on the browser's timezone via a typo'd
// local getter. See tickets/calendar-view/plan.md §3.1.
export function isMidnightUtc(iso: string): boolean {
  return iso.endsWith("T00:00:00.000Z");
}

// Returns null if there's nothing to place (a task with no dueDate; the null check is
// defensive since events always have a date).
export function entryToCalendarEvent(entry: CalendarEntry): EventInput | null {
  const iso = entry.kind === "task" ? entry.dueDate : entry.date;
  if (!iso) return null;

  const allDay = isMidnightUtc(iso);

  return {
    id: entry.id,
    title: entry.title,
    // Sliced off the wire string's own characters, not re-parsed via `new Date`, for the
    // same timezone-independence reason as `isMidnightUtc` above.
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

// Built from the dropped-to Date's *local* getters, never toISOString() — toISOString()
// would convert to UTC and shift the day/hour in a non-UTC browser timezone. Client-side
// concern only; see tickets/calendar-view/plan.md §3.1 for the separate server-side
// timezone issue this hands off into.
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

// Pure function, not inlined in CalendarPage's `handleEventDrop`, so the dispatch logic
// is unit-testable directly (tickets/calendar-view/plan.md §3.4).
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
