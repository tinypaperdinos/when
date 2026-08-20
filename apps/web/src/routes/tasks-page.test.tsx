import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "server";
import { TRPCProvider } from "../trpc";
import { TasksPage } from "./tasks-page";

function renderTasksPage(fetchImpl: typeof fetch) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/trpc", fetch: fetchImpl })],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <TasksPage />
      </TRPCProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

// TasksPage fires tasks.list and tags.list in the same render tick, and
// httpBatchLink joins them into one batched request whose URL path is the
// comma-joined procedure names (`.../trpc/tasks.list,tags.list?...`) — see
// tickets/tags/plan.md §2.4. This helper parses that path and returns each
// procedure's response in the same order the batch requested them, keyed by a
// caller-supplied { "tasks.list": [...], "tags.list": [...] } map.
function batchFetch(byPath: Record<string, unknown>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const pathSegment = decodeURIComponent(new URL(url, "http://localhost").pathname)
      .split("/trpc/")[1];
    const paths = pathSegment.split(",");
    return jsonResponse(paths.map((path) => ({ result: { data: byPath[path] } })));
  }) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TasksPage", () => {
  it("renders a loading state before the query resolves", () => {
    const pendingFetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;

    renderTasksPage(pendingFetch);

    expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
  });

  it("renders the populated list once tasks resolve", async () => {
    const fetchImpl = batchFetch({
      "tasks.list": [
        {
          id: "1",
          kind: "task",
          title: "Buy milk",
          notes: null,
          dueDate: null,
          completed: false,
          date: null,
          tags: [],
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      "tags.list": [],
    });

    renderTasksPage(fetchImpl);

    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
  });

  it("renders a tag badge for a task that has tags", async () => {
    const fetchImpl = batchFetch({
      "tasks.list": [
        {
          id: "1",
          kind: "task",
          title: "Buy milk",
          notes: null,
          dueDate: null,
          completed: false,
          date: null,
          tags: [{ id: "t1", name: "urgent" }],
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      "tags.list": [{ id: "t1", name: "urgent" }],
    });

    renderTasksPage(fetchImpl);

    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("renders the Tasks heading", () => {
    const fetchImpl = batchFetch({ "tasks.list": [], "tags.list": [] });

    renderTasksPage(fetchImpl);

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
  });

  it("renders the create form alongside the list", async () => {
    const fetchImpl = batchFetch({ "tasks.list": [], "tags.list": [] });

    renderTasksPage(fetchImpl);

    expect(await screen.findByText(/no tasks yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Task title")).toBeInTheDocument();
  });

  it("renders an explicit empty state for an empty list", async () => {
    const fetchImpl = batchFetch({ "tasks.list": [], "tags.list": [] });

    renderTasksPage(fetchImpl);

    expect(await screen.findByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it("renders an error state when the request fails", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.reject(new Error("network error")),
    ) as unknown as typeof fetch;

    renderTasksPage(fetchImpl);

    expect(
      await screen.findByText(/something went wrong loading tasks/i),
    ).toBeInTheDocument();
  });
});
