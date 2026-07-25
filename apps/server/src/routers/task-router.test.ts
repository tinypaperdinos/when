import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("../db", () => ({
  db: {
    entry: { findMany },
  },
}));

describe("tasksRouter", () => {
  it("wires the router to TaskService.list() via createCaller", async () => {
    const rows = [{ id: "1", title: "Buy milk", kind: "task" }];
    findMany.mockResolvedValue(rows);

    const { appRouter } = await import("./app-router");
    const caller = appRouter.createCaller({});

    const result = await caller.tasks.list();

    expect(result).toBe(rows);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: "task" } }),
    );
  });
});
