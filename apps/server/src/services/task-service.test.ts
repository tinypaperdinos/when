import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { TaskService } from "./task-service";

function createFakeDb(overrides: {
  findManyResult?: unknown[];
  findUniqueResult?: unknown;
  createResult?: unknown;
  updateResult?: unknown;
  deleteResult?: unknown;
} = {}) {
  return {
    entry: {
      findMany: vi.fn().mockResolvedValue(overrides.findManyResult ?? []),
      findUnique: vi.fn().mockResolvedValue(overrides.findUniqueResult ?? null),
      create: vi.fn().mockResolvedValue(overrides.createResult ?? {}),
      update: vi.fn().mockResolvedValue(overrides.updateResult ?? {}),
      delete: vi.fn().mockResolvedValue(overrides.deleteResult ?? {}),
    },
  } as unknown as PrismaClient;
}

describe("TaskService", () => {
  describe("list", () => {
    it("filters to kind: task, excluding events", async () => {
      const db = createFakeDb({ findManyResult: [] });
      const service = new TaskService(db);

      await service.list();

      expect(db.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kind: "task" },
          orderBy: { dueDate: "asc" },
        }),
      );
    });

    it("returns whatever the db resolves with, unmodified", async () => {
      const rows = [{ id: "1", title: "Buy milk" }];
      const db = createFakeDb({ findManyResult: rows });
      const service = new TaskService(db);

      const result = await service.list();

      expect(result).toBe(rows);
    });

    it("returns [] when there are no matching rows", async () => {
      const db = createFakeDb({ findManyResult: [] });
      const service = new TaskService(db);

      const result = await service.list();

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("passes the title through unchanged — trimming happens upstream in the router's Zod schema, tested in task-router.test.ts", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "  Buy milk  " });

      expect(db.entry.create).toHaveBeenCalledWith({
        data: {
          kind: "task",
          title: "  Buy milk  ",
          dueDate: undefined,
        },
      });
    });

    it("always passes kind: 'task' regardless of anything else in the input", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "Buy milk" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ kind: "task" }) }),
      );
    });

    it("stores an undefined dueDate (Prisma persists it as null) when dueDate is omitted", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "Buy milk" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ dueDate: undefined }) }),
      );
    });

    it("converts a date-only dueDate string into a real Date before the db call", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "Buy milk", dueDate: "2026-07-26" });

      expect(db.entry.create).toHaveBeenCalledWith({
        data: {
          kind: "task",
          title: "Buy milk",
          dueDate: new Date("2026-07-26"),
        },
      });
    });

    it("converts a date+time dueDate string into a real Date before the db call", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "Buy milk", dueDate: "2026-07-26T14:30" });

      expect(db.entry.create).toHaveBeenCalledWith({
        data: {
          kind: "task",
          title: "Buy milk",
          dueDate: new Date("2026-07-26T14:30"),
        },
      });
    });
  });

  describe("update", () => {
    it("throws NOT_FOUND for an unknown id", async () => {
      const db = createFakeDb({ findUniqueResult: null });
      const service = new TaskService(db);

      await expect(service.update("missing", { title: "New title" })).rejects.toThrow(
        TRPCError,
      );
      await expect(service.update("missing", { title: "New title" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when the id exists but is an event, not a task", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new TaskService(db);

      await expect(service.update("1", { title: "New title" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.entry.update).not.toHaveBeenCalled();
    });

    it("leaves dueDate untouched (passes undefined) on a title-only update", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.update("1", { title: "New title" });

      expect(db.entry.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: "New title", dueDate: undefined },
      });
    });

    it("clears an existing due date when dueDate is null", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.update("1", { dueDate: null });

      expect(db.entry.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: undefined, dueDate: null },
      });
    });

    it("converts and sets a new due date when dueDate is a valid string", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.update("1", { dueDate: "2026-07-26" });

      expect(db.entry.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: undefined, dueDate: new Date("2026-07-26") },
      });
    });
  });

  describe("toggleComplete", () => {
    it("throws NOT_FOUND for an unknown id", async () => {
      const db = createFakeDb({ findUniqueResult: null });
      const service = new TaskService(db);

      await expect(service.toggleComplete("missing", true)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when the id exists but is an event", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new TaskService(db);

      await expect(service.toggleComplete("1", true)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.entry.update).not.toHaveBeenCalled();
    });

    it("sets completed to true", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.toggleComplete("1", true);

      expect(db.entry.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { completed: true },
      });
    });

    it("sets completed to false", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.toggleComplete("1", false);

      expect(db.entry.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { completed: false },
      });
    });

    it("is idempotent: calling it twice with the same completed: true payload is a no-op the second time", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.toggleComplete("1", true);
      await service.toggleComplete("1", true);

      expect(db.entry.update).toHaveBeenCalledTimes(2);
      expect(db.entry.update).toHaveBeenNthCalledWith(1, {
        where: { id: "1" },
        data: { completed: true },
      });
      expect(db.entry.update).toHaveBeenNthCalledWith(2, {
        where: { id: "1" },
        data: { completed: true },
      });
    });
  });

  describe("delete", () => {
    it("throws NOT_FOUND for an unknown id", async () => {
      const db = createFakeDb({ findUniqueResult: null });
      const service = new TaskService(db);

      await expect(service.delete("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND when the id exists but is an event", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new TaskService(db);

      await expect(service.delete("1")).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(db.entry.delete).not.toHaveBeenCalled();
    });

    it("calls db.entry.delete with { where: { id } } and resolves to { id }", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      const result = await service.delete("1");

      expect(db.entry.delete).toHaveBeenCalledWith({ where: { id: "1" } });
      expect(result).toEqual({ id: "1" });
    });
  });
});
