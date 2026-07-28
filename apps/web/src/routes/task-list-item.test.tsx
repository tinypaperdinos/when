import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "server";
import { TRPCProvider } from "../trpc";
import type { Task } from "../trpc";
import { TaskListItem } from "./task-list-item";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
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
    ...overrides,
  } as unknown as Task;
}

function renderTaskListItem(
  task: Task,
  fetchImpl: typeof fetch,
  tagSuggestions?: string[],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/trpc", fetch: fetchImpl })],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ul>
          <TaskListItem task={task} tagSuggestions={tagSuggestions} />
        </ul>
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

function errorFetch(message: string, code = "NOT_FOUND", httpStatus = 404) {
  return vi.fn(() =>
    jsonResponse(
      [{ error: { message, code: -32004, data: { code, httpStatus } } }],
      httpStatus,
    ),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TaskListItem", () => {
  it("reflects task.completed via the checkbox", () => {
    renderTaskListItem(makeTask({ completed: true }), vi.fn() as unknown as typeof fetch);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("defaults to unchecked when completed is undefined on a partial fixture", () => {
    const task = makeTask();
    // @ts-expect-error deliberately simulating a partial/legacy-shaped fixture
    delete task.completed;

    renderTaskListItem(task, vi.fn() as unknown as typeof fetch);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("toggling the checkbox calls toggleComplete with the checkbox's new value, not the old one", async () => {
    const fetchImpl = successFetch({ id: "1", completed: true });
    renderTaskListItem(makeTask({ completed: false }), fetchImpl);

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", completed: true },
    });
  });

  it("renders a formatted due date when present", () => {
    renderTaskListItem(
      makeTask({ dueDate: "2026-07-26T00:00:00.000Z" }),
      vi.fn() as unknown as typeof fetch,
    );

    expect(screen.getByText(/Due /)).toBeInTheDocument();
  });

  it("omits the due date line when dueDate is null", () => {
    renderTaskListItem(makeTask({ dueDate: null }), vi.fn() as unknown as typeof fetch);

    expect(screen.queryByText(/Due /)).not.toBeInTheDocument();
  });

  it("renders notes text in the non-editing view when present", () => {
    renderTaskListItem(
      makeTask({ notes: "Get oat milk" }),
      vi.fn() as unknown as typeof fetch,
    );

    expect(screen.getByText("Get oat milk")).toBeInTheDocument();
  });

  it("renders nothing extra when notes is null", () => {
    renderTaskListItem(makeTask({ notes: null }), vi.fn() as unknown as typeof fetch);

    expect(screen.queryByText("Get oat milk")).not.toBeInTheDocument();
  });

  it("renders a Badge per tag in the non-editing view when tags is non-empty", () => {
    renderTaskListItem(
      makeTask({ tags: [{ id: "t1", name: "urgent" }, { id: "t2", name: "home" }] }),
      vi.fn() as unknown as typeof fetch,
    );

    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("renders no tag section in the non-editing view when tags is []", () => {
    renderTaskListItem(makeTask({ tags: [] }), vi.fn() as unknown as typeof fetch);

    expect(screen.queryByText("urgent")).not.toBeInTheDocument();
  });

  it("defaults to no tag badges when tags is undefined on a partial fixture", () => {
    const task = makeTask();
    // @ts-expect-error deliberately simulating a partial/legacy-shaped fixture
    delete task.tags;

    expect(() =>
      renderTaskListItem(task, vi.fn() as unknown as typeof fetch),
    ).not.toThrow();
  });

  it("clicking Edit shows a title field pre-filled with the current title", () => {
    renderTaskListItem(makeTask({ title: "Buy milk" }), vi.fn() as unknown as typeof fetch);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      (screen.getByLabelText("Edit task title") as HTMLInputElement).value,
    ).toBe("Buy milk");
  });

  it("clicking Edit shows a notes field pre-filled with the current notes", () => {
    renderTaskListItem(
      makeTask({ notes: "Get oat milk" }),
      vi.fn() as unknown as typeof fetch,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      (screen.getByLabelText("Edit task notes") as HTMLTextAreaElement).value,
    ).toBe("Get oat milk");
  });

  it("clicking Edit shows an empty notes field when task.notes is null", () => {
    renderTaskListItem(makeTask({ notes: null }), vi.fn() as unknown as typeof fetch);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      (screen.getByLabelText("Edit task notes") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("clicking Edit pre-fills the TagInput with the task's current tags as removable chips", () => {
    renderTaskListItem(
      makeTask({ tags: [{ id: "t1", name: "urgent" }, { id: "t2", name: "home" }] }),
      vi.fn() as unknown as typeof fetch,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Remove urgent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove home" })).toBeInTheDocument();
  });

  it("clicking Edit on a task with no tags shows an empty TagInput", () => {
    renderTaskListItem(makeTask({ tags: [] }), vi.fn() as unknown as typeof fetch);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.queryByLabelText(/^Remove /)).not.toBeInTheDocument();
  });

  it("clicking Edit pre-fills a date-only due date", () => {
    renderTaskListItem(
      makeTask({ dueDate: "2026-07-26" }),
      vi.fn() as unknown as typeof fetch,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      (screen.getByLabelText("Edit due date") as HTMLInputElement).value,
    ).toBe("2026-07-26");
    expect(screen.queryByLabelText("Edit due time")).not.toBeInTheDocument();
  });

  it("clicking Edit pre-fills a date+time due date", () => {
    renderTaskListItem(
      makeTask({ dueDate: "2026-07-26T14:30" }),
      vi.fn() as unknown as typeof fetch,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      (screen.getByLabelText("Edit due date") as HTMLInputElement).value,
    ).toBe("2026-07-26");
    expect(
      (screen.getByLabelText("Edit due time") as HTMLInputElement).value,
    ).toBe("14:30");
  });

  it("clicking Edit on a task with no due date shows an empty due date field", () => {
    renderTaskListItem(makeTask({ dueDate: null }), vi.fn() as unknown as typeof fetch);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      (screen.getByLabelText("Edit due date") as HTMLInputElement).value,
    ).toBe("");
  });

  it("does not throw when editing a partial fixture missing dueDate entirely", () => {
    const task = makeTask();
    // @ts-expect-error deliberately simulating a partial/legacy-shaped fixture
    delete task.dueDate;

    renderTaskListItem(task, vi.fn() as unknown as typeof fetch);

    expect(() => fireEvent.click(screen.getByRole("button", { name: "Edit" }))).not.toThrow();
    expect(
      (screen.getByLabelText("Edit due date") as HTMLInputElement).value,
    ).toBe("");
  });

  it("Save calls update with the trimmed edited title and exits edit mode", async () => {
    const fetchImpl = successFetch({ id: "1", title: "New title" });
    renderTaskListItem(makeTask({ title: "Buy milk" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task title"), {
      target: { value: "  New title  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "New title", notes: null, tags: [], dueDate: null },
    });

    await waitFor(() =>
      expect(screen.queryByLabelText("Edit task title")).not.toBeInTheDocument(),
    );
  });

  it("Save sends the trimmed notes string when notes is set", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });
    renderTaskListItem(makeTask({ title: "Buy milk" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task notes"), {
      target: { value: "  Get oat milk  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "Buy milk", notes: "Get oat milk", tags: [], dueDate: null },
    });
  });

  it("Save sends null for notes when the field is cleared to empty/whitespace", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });
    renderTaskListItem(makeTask({ title: "Buy milk", notes: "Old notes" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task notes"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "Buy milk", notes: null, tags: [], dueDate: null },
    });
  });

  it("Save includes the full updated tag array (existing + new) after adding a tag in edit mode", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });
    renderTaskListItem(makeTask({ title: "Buy milk", tags: [{ id: "t1", name: "urgent" }] }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task tags"), { target: { value: "home" } });
    fireEvent.keyDown(screen.getByLabelText("Edit task tags"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "Buy milk", notes: null, tags: ["urgent", "home"], dueDate: null },
    });
  });

  it("Save includes only the remaining tags after removing one tag in edit mode", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });
    renderTaskListItem(
      makeTask({
        title: "Buy milk",
        tags: [{ id: "t1", name: "urgent" }, { id: "t2", name: "home" }],
      }),
      fetchImpl,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove urgent" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "Buy milk", notes: null, tags: ["home"], dueDate: null },
    });
  });

  it("sends tags: [] explicitly after removing the only tag in edit mode", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });
    renderTaskListItem(
      makeTask({ title: "Buy milk", tags: [{ id: "t1", name: "urgent" }] }),
      fetchImpl,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove urgent" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "Buy milk", notes: null, tags: [], dueDate: null },
    });
  });

  it("Save sends the edited due date in the update payload", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });
    renderTaskListItem(makeTask({ title: "Buy milk", dueDate: null }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit due date"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "Buy milk", notes: null, tags: [], dueDate: "2026-08-01" },
    });
  });

  it("Save sends dueDate: null after clearing the date field", async () => {
    const fetchImpl = successFetch({ id: "1", title: "Buy milk" });
    renderTaskListItem(makeTask({ title: "Buy milk", dueDate: "2026-07-26" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit due date"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      0: { id: "1", title: "Buy milk", notes: null, tags: [], dueDate: null },
    });
  });

  it("Cancel discards a due-date edit without calling update", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    renderTaskListItem(makeTask({ title: "Buy milk", dueDate: "2026-07-26" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit due date"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Edit due date")).not.toBeInTheDocument();
    expect(screen.getByText(/Due /)).toBeInTheDocument();
  });

  it("Cancel discards a tag change without calling update and leaves the read view's tags unaffected", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    renderTaskListItem(makeTask({ title: "Buy milk", tags: [{ id: "t1", name: "urgent" }] }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task tags"), { target: { value: "home" } });
    fireEvent.keyDown(screen.getByLabelText("Edit task tags"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Edit task tags")).not.toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.queryByText("home")).not.toBeInTheDocument();
  });

  it("Cancel exits edit mode without calling update and discards the typed change", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    renderTaskListItem(makeTask({ title: "Buy milk" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task title"), {
      target: { value: "Discarded title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Edit task title")).not.toBeInTheDocument();
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });

  it("Cancel discards a typed notes change without calling update and without mutating the read-only view", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    renderTaskListItem(makeTask({ title: "Buy milk", notes: "Original notes" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task notes"), {
      target: { value: "Discarded notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Edit task notes")).not.toBeInTheDocument();
    expect(screen.getByText("Original notes")).toBeInTheDocument();
    expect(screen.queryByText("Discarded notes")).not.toBeInTheDocument();
  });

  it("Delete calls delete only when window.confirm is confirmed", async () => {
    const fetchImpl = successFetch({ id: "1" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderTaskListItem(makeTask(), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
  });

  it("Delete does not call delete when window.confirm is cancelled", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTaskListItem(makeTask(), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("renders an inline error when toggleComplete fails, leaving the checkbox's displayed state unaffected", async () => {
    const fetchImpl = errorFetch("Task 1 not found");
    renderTaskListItem(makeTask({ completed: false }), fetchImpl);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(await screen.findByText(/Task 1 not found/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("renders an inline error when update fails, staying in edit mode with editTitle preserved", async () => {
    const fetchImpl = errorFetch("Task 1 not found");
    renderTaskListItem(makeTask({ title: "Buy milk" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task title"), {
      target: { value: "Edited title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Task 1 not found/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Edit task title") as HTMLInputElement).value,
    ).toBe("Edited title");
  });

  it("renders an inline error when update fails, staying in edit mode with editNotes preserved", async () => {
    const fetchImpl = errorFetch("Task 1 not found");
    renderTaskListItem(makeTask({ title: "Buy milk" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit task notes"), {
      target: { value: "Edited notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Task 1 not found/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Edit task notes") as HTMLTextAreaElement).value,
    ).toBe("Edited notes");
  });

  it("renders an inline error when update fails, staying in edit mode with editDueDateValue preserved", async () => {
    const fetchImpl = errorFetch("Task 1 not found");
    renderTaskListItem(makeTask({ title: "Buy milk", dueDate: null }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit due date"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Task 1 not found/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Edit due date") as HTMLInputElement).value,
    ).toBe("2026-08-01");
  });

  it("renders an inline error when delete fails (confirmed), leaving the row present", async () => {
    const fetchImpl = errorFetch("Task 1 not found");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderTaskListItem(makeTask({ title: "Buy milk" }), fetchImpl);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/Task 1 not found/)).toBeInTheDocument();
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });
});
