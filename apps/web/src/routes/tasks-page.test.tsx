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
    const fetchImpl = vi.fn(() =>
      jsonResponse([
        {
          result: {
            data: [
              {
                id: "1",
                kind: "task",
                title: "Buy milk",
                notes: null,
                dueDate: null,
                completed: false,
                date: null,
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          },
        },
      ]),
    ) as unknown as typeof fetch;

    renderTasksPage(fetchImpl);

    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
  });

  it("renders the create form alongside the list", async () => {
    const fetchImpl = vi.fn(() =>
      jsonResponse([{ result: { data: [] } }]),
    ) as unknown as typeof fetch;

    renderTasksPage(fetchImpl);

    expect(await screen.findByText(/no tasks yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Task title")).toBeInTheDocument();
  });

  it("renders an explicit empty state for an empty list", async () => {
    const fetchImpl = vi.fn(() =>
      jsonResponse([{ result: { data: [] } }]),
    ) as unknown as typeof fetch;

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
