import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("../db", () => ({
  db: {
    tag: { findMany },
    entry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tagsRouter", () => {
  it("wires the router to TagService.list() via createCaller", async () => {
    const rows = [{ id: "1", name: "urgent" }];
    findMany.mockResolvedValue(rows);

    const { appRouter } = await import("./app-router");
    const caller = appRouter.createCaller({});

    const result = await caller.tags.list();

    expect(result).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });

  it("resolves [] when there are no tags in the db", async () => {
    findMany.mockResolvedValue([]);

    const { appRouter } = await import("./app-router");
    const caller = appRouter.createCaller({});

    const result = await caller.tags.list();

    expect(result).toEqual([]);
  });
});
