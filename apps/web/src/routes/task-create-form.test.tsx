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
  return vi.fn(() => jsonResponse([{ result: { data: row } }])) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("TaskCreateForm", () => {
  it("submits the trimmed title with no dueDate or tags for plain text", async () => {
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

  it("submits a date-only dueDate payload for a date-phrase input", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 1));

    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk tomorrow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    vi.useRealTimers();
    await screen.findByRole("button", { name: "Add task" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { title: "Buy milk", dueDate: "2026-07-02" },
    });
  });

  it("submits a dueDate payload with a time component when the phrase includes a time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 1));

    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk tomorrow at 5pm" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    vi.useRealTimers();
    await screen.findByRole("button", { name: "Add task" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { title: "Buy milk", dueDate: "2026-07-02T17:00" },
    });
  });

  it("submits tags for one or more #tag tokens typed into the input", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk #errand #urgent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await screen.findByRole("button", { name: "Add task" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { title: "Buy milk", tags: ["errand", "urgent"] },
    });
  });

  it("omits dueDate from the payload when nothing parses", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await screen.findByRole("button", { name: "Add task" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { title: "Buy milk" },
    });
  });

  it("omits tags from the payload when no #tag token is present", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await screen.findByRole("button", { name: "Add task" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { title: "Buy milk" },
    });
  });

  it("does not call the mutation when the input is empty or whitespace-only", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call the mutation when the input resolves to an empty title", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "tomorrow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call the mutation when the input is only a tag", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "#chores" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resets the input to empty and hides the live preview on success", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });

    renderTaskCreateForm(fetchImpl);

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Buy milk #errand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() =>
      expect((screen.getByLabelText("Task title") as HTMLInputElement).value).toBe(""),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders an inline error and preserves the raw input text on mutation failure", async () => {
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
      target: { value: "Buy milk #errand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect((screen.getByLabelText("Task title") as HTMLInputElement).value).toBe(
      "Buy milk #errand",
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

  describe("live preview", () => {
    it("shows nothing when neither a date phrase nor a tag is present", () => {
      renderTaskCreateForm(vi.fn() as unknown as typeof fetch);

      fireEvent.change(screen.getByLabelText("Task title"), {
        target: { value: "Buy milk" },
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows a 'Due …' line reflecting the resolved date when typing a date phrase", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 1));

      renderTaskCreateForm(vi.fn() as unknown as typeof fetch);

      fireEvent.change(screen.getByLabelText("Task title"), {
        target: { value: "Buy milk tomorrow" },
      });

      expect(screen.getByText(/^Due /)).toBeInTheDocument();
    });

    it("shows a Badge with the tag's text when typing a #tag", () => {
      renderTaskCreateForm(vi.fn() as unknown as typeof fetch);

      fireEvent.change(screen.getByLabelText("Task title"), {
        target: { value: "Buy milk #errand" },
      });

      expect(screen.getByText("errand")).toBeInTheDocument();
    });

    it("swaps the previewed date in place when the detected phrase changes", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 1));

      renderTaskCreateForm(vi.fn() as unknown as typeof fetch);

      fireEvent.change(screen.getByLabelText("Task title"), {
        target: { value: "Buy milk tomorrow" },
      });
      const tomorrowText = screen.getByText(/^Due /).textContent;

      fireEvent.change(screen.getByLabelText("Task title"), {
        target: { value: "Buy milk in 3 days" },
      });
      const laterText = screen.getByText(/^Due /).textContent;

      expect(screen.getAllByText(/^Due /)).toHaveLength(1);
      expect(laterText).not.toBe(tomorrowText);
    });

    it("exposes role=status and aria-live=polite on the preview container", () => {
      renderTaskCreateForm(vi.fn() as unknown as typeof fetch);

      fireEvent.change(screen.getByLabelText("Task title"), {
        target: { value: "Buy milk #errand" },
      });

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });
  });
});
