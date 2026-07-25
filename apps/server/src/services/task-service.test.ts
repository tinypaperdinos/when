import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { TaskService } from "./task-service";

function createFakeDb(findManyResult: unknown[]) {
  return {
    entry: {
      findMany: vi.fn().mockResolvedValue(findManyResult),
    },
  } as unknown as PrismaClient;
}

describe("TaskService", () => {
  it("filters to kind: task, excluding events", async () => {
    const db = createFakeDb([]);
    const service = new TaskService(db);

    await service.list();

    expect(db.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: "task" } }),
    );
  });

  it("returns whatever the db resolves with, unmodified", async () => {
    const rows = [{ id: "1", title: "Buy milk" }];
    const db = createFakeDb(rows);
    const service = new TaskService(db);

    const result = await service.list();

    expect(result).toBe(rows);
  });

  it("returns [] when there are no matching rows", async () => {
    const db = createFakeDb([]);
    const service = new TaskService(db);

    const result = await service.list();

    expect(result).toEqual([]);
  });
});
