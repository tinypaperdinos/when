import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "server";
import type { EventDropArg } from "@fullcalendar/core";
import { TRPCProvider } from "../trpc";
import { CalendarPage } from "./calendar-page";

// FullCalendar's drag-and-drop is driven by low-level pointer events on its own internal
// DOM structure; reliably simulating a real drag gesture through it in jsdom isn't
// practical (tickets/calendar-view/plan.md §3.4). This mock renders the `events` prop as
// plain text nodes (enough to cover loading/error/populated/empty states) and captures
// the `eventDrop` callback so drop-dispatch tests can invoke it directly with a hand-built
// fake `EventDropArg`-shaped object, without needing FullCalendar's real pointer
// machinery.
let capturedEventDrop: ((info: EventDropArg) => void) | undefined;

vi.mock("@fullcalendar/react", () => ({
  default: (props: {
    events: { id: string; title: string }[];
    eventDrop: (info: EventDropArg) => void;
  }) => {
    capturedEventDrop = props.eventDrop;
    return (
      <div data-testid="fullcalendar-mock">
        {props.events.map((event) => (
          <div key={event.id}>{event.title}</div>
        ))}
      </div>
    );
  },
}));

vi.mock("@fullcalendar/daygrid", () => ({ default: {} }));
vi.mock("@fullcalendar/timegrid", () => ({ default: {} }));
vi.mock("@fullcalendar/list", () => ({ default: {} }));
vi.mock("@fullcalendar/interaction", () => ({ default: {} }));

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

// Builds a fetch mock for the batched tRPC request `CalendarPage` issues (tasks.list +
// events.list, in whichever order httpBatchLink puts them in the URL) by inspecting the
// requested path list rather than assuming a fixed order.
function batchedListFetch(dataByPath: Record<string, unknown[]>) {
  return vi.fn((url: string | URL) => {
    const match = url.toString().match(/\/trpc\/([^?]+)/);
    const paths = match ? match[1].split(",") : [];
    return jsonResponse(paths.map((path) => ({ result: { data: dataByPath[path] ?? [] } })));
  });
}

function renderCalendarPage(fetchImpl: (url: string | URL) => Promise<Response>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/trpc", fetch: fetchImpl as unknown as typeof fetch })],
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          <CalendarPage />
        </TRPCProvider>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}

const task = {
  id: "task-1",
  kind: "task",
  title: "Buy milk",
  notes: null,
  dueDate: "2026-07-28T00:00:00.000Z",
  completed: false,
  date: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const completedTask = { ...task, id: "task-2", title: "Water plants", completed: true };

const event = {
  id: "event-1",
  kind: "event",
  title: "Team standup",
  notes: null,
  dueDate: null,
  completed: null,
  date: "2026-07-28T09:00:00.000Z",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  capturedEventDrop = undefined;
});

describe("CalendarPage", () => {
  it("renders a loading state before either query resolves", () => {
    const pendingFetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;

    renderCalendarPage(pendingFetch);

    expect(screen.getByText(/loading calendar/i)).toBeInTheDocument();
  });

  it("renders an error state when either query fails", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.reject(new Error("network error")),
    ) as unknown as typeof fetch;

    renderCalendarPage(fetchImpl);

    expect(
      await screen.findByText(/something went wrong loading the calendar/i),
    ).toBeInTheDocument();
  });

  it("renders both a task and an event once both queries resolve", async () => {
    const fetchImpl = batchedListFetch({
      "tasks.list": [task],
      "events.list": [event],
    });

    renderCalendarPage(fetchImpl);

    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
    expect(await screen.findByText("Team standup")).toBeInTheDocument();
  });

  it("renders without throwing when both lists are empty", async () => {
    const fetchImpl = batchedListFetch({ "tasks.list": [], "events.list": [] });

    renderCalendarPage(fetchImpl);

    expect(await screen.findByTestId("fullcalendar-mock")).toBeInTheDocument();
  });

  it("still renders a completed task, as a valid drop target", async () => {
    const fetchImpl = batchedListFetch({ "tasks.list": [completedTask], "events.list": [] });

    renderCalendarPage(fetchImpl);

    expect(await screen.findByText("Water plants")).toBeInTheDocument();
  });

  it("dispatches to tasks.update with dueDate when a task is dropped", async () => {
    const fetchImpl = batchedListFetch({ "tasks.list": [task], "events.list": [] });

    renderCalendarPage(fetchImpl);
    await screen.findByText("Buy milk");

    fetchImpl.mockClear();

    capturedEventDrop?.({
      event: {
        id: "task-1",
        start: new Date(2026, 6, 30),
        allDay: true,
        extendedProps: { kind: "task" },
      },
      revert: vi.fn(),
    } as unknown as EventDropArg);

    await waitFor(() => {
      const call = (fetchImpl.mock.calls as unknown as [string | URL][]).find(([url]) =>
        url.toString().includes("tasks.update"),
      );
      expect(call).toBeTruthy();
    });
  });

  it("dispatches to events.update with date when an event is dropped", async () => {
    const fetchImpl = batchedListFetch({ "tasks.list": [], "events.list": [event] });

    renderCalendarPage(fetchImpl);
    await screen.findByText("Team standup");

    fetchImpl.mockClear();

    capturedEventDrop?.({
      event: {
        id: "event-1",
        start: new Date(2026, 6, 30, 10, 15),
        allDay: false,
        extendedProps: { kind: "event" },
      },
      revert: vi.fn(),
    } as unknown as EventDropArg);

    await waitFor(() => {
      const call = (fetchImpl.mock.calls as unknown as [string | URL][]).find(([url]) =>
        url.toString().includes("events.update"),
      );
      expect(call).toBeTruthy();
    });
  });

  it("reverts and shows an inline error when a reschedule mutation fails", async () => {
    const fetchImpl = vi.fn((url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("tasks.update")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ error: { message: "Could not save", code: -32603 } }]),
            { status: 500, headers: { "content-type": "application/json" } },
          ),
        );
      }
      const match = urlStr.match(/\/trpc\/([^?]+)/);
      const paths = match ? match[1].split(",") : [];
      const dataByPath: Record<string, unknown[]> = { "tasks.list": [task], "events.list": [] };
      return jsonResponse(paths.map((path) => ({ result: { data: dataByPath[path] ?? [] } })));
    }) as unknown as typeof fetch;

    renderCalendarPage(fetchImpl);
    await screen.findByText("Buy milk");

    const revert = vi.fn();
    capturedEventDrop?.({
      event: {
        id: "task-1",
        start: new Date(2026, 6, 30),
        allDay: true,
        extendedProps: { kind: "task" },
      },
      revert,
    } as unknown as EventDropArg);

    await waitFor(() => expect(revert).toHaveBeenCalled());
    expect(await screen.findByText(/couldn't reschedule: could not save/i)).toBeInTheDocument();
  });

  it("clears a stale drag-error banner after a later, unrelated successful drag", async () => {
    let taskUpdateCalls = 0;
    const fetchImpl = vi.fn((url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("tasks.update")) {
        taskUpdateCalls += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify([{ error: { message: "Could not save", code: -32603 } }]),
            { status: 500, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (urlStr.includes("events.update")) {
        return jsonResponse([{ result: { data: { ...event, date: "2026-07-30T10:15" } } }]);
      }
      const match = urlStr.match(/\/trpc\/([^?]+)/);
      const paths = match ? match[1].split(",") : [];
      const dataByPath: Record<string, unknown[]> = {
        "tasks.list": [task],
        "events.list": [event],
      };
      return jsonResponse(paths.map((path) => ({ result: { data: dataByPath[path] ?? [] } })));
    }) as unknown as typeof fetch;

    renderCalendarPage(fetchImpl);
    await screen.findByText("Buy milk");
    await screen.findByText("Team standup");

    // First, a failed task drag: banner appears.
    capturedEventDrop?.({
      event: {
        id: "task-1",
        start: new Date(2026, 6, 30),
        allDay: true,
        extendedProps: { kind: "task" },
      },
      revert: vi.fn(),
    } as unknown as EventDropArg);

    await screen.findByText(/couldn't reschedule/i);
    expect(taskUpdateCalls).toBe(1);

    // Then, a successful, unrelated event drag: the stale banner should clear.
    capturedEventDrop?.({
      event: {
        id: "event-1",
        start: new Date(2026, 6, 30, 10, 15),
        allDay: false,
        extendedProps: { kind: "event" },
      },
      revert: vi.fn(),
    } as unknown as EventDropArg);

    await waitFor(() => {
      expect(screen.queryByText(/couldn't reschedule/i)).not.toBeInTheDocument();
    });
  });
});
