import { describe, expect, it } from "vitest";
import {
  isMidnightUtc,
  entryToCalendarEvent,
  calendarEntries,
  wireDateFromDrop,
  buildRescheduleMutationArgs,
} from "./calendar-events";
import type { Task, EventEntry } from "../trpc";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    kind: "task",
    title: "A task",
    notes: null,
    dueDate: null,
    completed: false,
    date: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as Task;
}

function makeEvent(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    id: "event-1",
    kind: "event",
    title: "An event",
    notes: null,
    dueDate: null,
    completed: null,
    date: "2026-07-28T14:30:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as EventEntry;
}

describe("isMidnightUtc", () => {
  it("is true for a wire timestamp at exactly UTC midnight", () => {
    expect(isMidnightUtc("2026-07-28T00:00:00.000Z")).toBe(true);
  });

  it("is false for any other UTC time-of-day", () => {
    expect(isMidnightUtc("2026-07-28T14:30:00.000Z")).toBe(false);
  });

  it("does not false-positive one millisecond off midnight", () => {
    expect(isMidnightUtc("2026-07-28T00:00:00.001Z")).toBe(false);
  });

  it("does not false-positive one second off midnight", () => {
    expect(isMidnightUtc("2026-07-28T00:00:01.000Z")).toBe(false);
  });
});

describe("entryToCalendarEvent", () => {
  it("returns null for a task with no dueDate", () => {
    expect(entryToCalendarEvent(makeTask({ dueDate: null }))).toBeNull();
  });

  it("places an event with a date", () => {
    const result = entryToCalendarEvent(makeEvent({ date: "2026-07-28T14:30:00.000Z" }));
    expect(result).not.toBeNull();
    expect(result?.id).toBe("event-1");
    expect(result?.allDay).toBe(false);
    expect(result?.start).toBe("2026-07-28T14:30:00.000Z");
  });

  it("renders a midnight-UTC wire timestamp as an all-day chip using the sliced date", () => {
    const result = entryToCalendarEvent(
      makeTask({ dueDate: "2026-07-28T00:00:00.000Z" as unknown as Task["dueDate"] }),
    );
    expect(result?.allDay).toBe(true);
    expect(result?.start).toBe("2026-07-28");
  });

  it("renders a non-midnight wire timestamp as a timed event with the full ISO string", () => {
    const result = entryToCalendarEvent(
      makeTask({ dueDate: "2026-07-28T14:30:00.000Z" as unknown as Task["dueDate"] }),
    );
    expect(result?.allDay).toBe(false);
    expect(result?.start).toBe("2026-07-28T14:30:00.000Z");
  });

  it("carries kind and completed in extendedProps for a task", () => {
    const result = entryToCalendarEvent(
      makeTask({
        dueDate: "2026-07-28T00:00:00.000Z" as unknown as Task["dueDate"],
        completed: true,
      }),
    );
    expect(result?.extendedProps).toEqual({ kind: "task", completed: true });
  });

  it("carries kind for an event, with completed undefined", () => {
    const result = entryToCalendarEvent(makeEvent());
    expect(result?.extendedProps).toEqual({ kind: "event", completed: undefined });
  });

  it("sets durationEditable to false", () => {
    const result = entryToCalendarEvent(makeEvent());
    expect(result?.durationEditable).toBe(false);
  });
});

describe("calendarEntries", () => {
  it("returns an empty array for undefined inputs (queries still pending)", () => {
    expect(calendarEntries(undefined, undefined)).toEqual([]);
  });

  it("merges tasks and events, dropping tasks with no dueDate", () => {
    const tasks: Task[] = [
      makeTask({ id: "t1", dueDate: "2026-07-28T00:00:00.000Z" as unknown as Task["dueDate"] }),
      makeTask({ id: "t2", dueDate: null }),
    ];
    const events: EventEntry[] = [makeEvent({ id: "e1" })];

    const result = calendarEntries(tasks, events);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["t1", "e1"]);
  });
});

describe("wireDateFromDrop", () => {
  it("builds a date-only string for an all-day drop from local getters", () => {
    // Use a date whose local-vs-UTC date would actually differ in some timezones to
    // exercise the "not toISOString()" guarantee, not just a timezone-insensitive case.
    const date = new Date(2026, 6, 28); // local July 28, 2026, midnight local time
    expect(wireDateFromDrop(date, true)).toBe("2026-07-28");
  });

  it("builds a zero-padded date-time string for a timed drop", () => {
    const date = new Date(2026, 6, 5, 9, 5); // local July 5, 2026, 09:05
    expect(wireDateFromDrop(date, false)).toBe("2026-07-05T09:05");
  });

  it("zero-pads single-digit hours and minutes", () => {
    const date = new Date(2026, 0, 1, 9, 5);
    expect(wireDateFromDrop(date, false)).toBe("2026-01-01T09:05");
  });

  it("produces month '01' (not '00') for a drop landing in January", () => {
    const date = new Date(2026, 0, 15);
    expect(wireDateFromDrop(date, true)).toBe("2026-01-15");
  });
});

describe("buildRescheduleMutationArgs", () => {
  it("builds a tasks.update payload with dueDate for a task drop", () => {
    const date = new Date(2026, 6, 28);
    const result = buildRescheduleMutationArgs("task-1", "task", date, true);
    expect(result).toEqual({ kind: "task", payload: { id: "task-1", dueDate: "2026-07-28" } });
  });

  it("builds an events.update payload with date for an event drop", () => {
    const date = new Date(2026, 6, 28, 14, 30);
    const result = buildRescheduleMutationArgs("event-1", "event", date, false);
    expect(result).toEqual({
      kind: "event",
      payload: { id: "event-1", date: "2026-07-28T14:30" },
    });
  });
});

// Note: item 10 in tickets/calendar-view/plan.md §4 (a task and an event sharing the same
// literal id string across kinds) is documented as impossible by construction (one
// `Entry` table, one cuid id space) rather than tested, since no code path could produce
// it.
