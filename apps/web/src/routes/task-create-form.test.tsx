import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "server";
import { TRPCProvider } from "../trpc";
import { TaskCreateForm } from "./task-create-form";

function renderTaskCreateForm(fetchImpl: typeof fetch) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/trpc", fetch: fetchImpl })],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <TaskCreateForm />
      </TRPCProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function successFetch(row: unknown) {
  return vi.fn(() =>
    jsonResponse([{ result: { data: row } }]),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TaskCreateForm", () => {
  it("submits the trimmed title with no dueDate when none is set", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "  Buy milk  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await screen.findByRole("button", { name: "Add task" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { title: "Buy milk" },
    });
  });

  it("submits the trimmed title with a dueDate payload when a due date is set", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2026-07-26" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await screen.findByRole("button", { name: "Add task" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { title: "Buy milk", dueDate: "2026-07-26" },
    });
  });

  it("does not call the mutation when the title is empty or whitespace-only", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resets both fields on success", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2026-07-26" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() =>
      expect((screen.getByLabelText("Task title") as HTMLInputElement).value).toBe(""),
    );
    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("");
  });

  it("renders an inline error and preserves fields when the mutation fails", async () => {
    const fetchImpl = vi.fn(() =>
      jsonResponse(
        [
          {
            error: {
              message: "Title is required",
              code: -32600,
              data: { code: "BAD_REQUEST", httpStatus: 400 },
            },
          },
        ],
        400,
      ),
    ) as unknown as typeof fetch;

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect((screen.getByLabelText("Task title") as HTMLInputElement).value).toBe(
      "Buy milk",
    );
  });

  it("disables the submit button while the mutation is pending", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled(),
    );

    resolveFetch(
      new Response(JSON.stringify([{ result: { data: { id: "1" } } }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add task" })).not.toBeDisabled(),
    );
  });
});
