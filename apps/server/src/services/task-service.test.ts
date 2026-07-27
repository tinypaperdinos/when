import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { TaskService } from "./task-service";
import type { TagService } from "./tag-service";

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

// Injectable in place of a real TagService — per §3.3 of tickets/tags/plan.md, tests
// exercise the TaskService<->TagService boundary via this fake rather than mocking
// db.tag directly.
function createFakeTagService(resolved: { id: string }[] = []) {
  return {
    resolveConnections: vi.fn().mockResolvedValue(resolved),
  } as unknown as TagService;
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

    it("includes tags in the findMany call", async () => {
      const db = createFakeDb({ findManyResult: [] });
      const service = new TaskService(db);

      await service.list();

      expect(db.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { tags: true } }),
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

    it("stores notes unchanged when provided", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "Buy milk", notes: "Get oat milk" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: "Get oat milk" }) }),
      );
    });

    it("stores an undefined notes (Prisma persists it as null) when notes is omitted", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "Buy milk" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: undefined }) }),
      );
    });

    it("normalizes a whitespace-only notes value to undefined rather than storing an empty string", async () => {
      const db = createFakeDb();
      const service = new TaskService(db);

      await service.create({ title: "Buy milk", notes: "" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: undefined }) }),
      );
    });

    describe("tags", () => {
      it("does not call tagService.resolveConnections when tags is omitted", async () => {
        const db = createFakeDb();
        const tagService = createFakeTagService();
        const service = new TaskService(db, tagService);

        await service.create({ title: "Buy milk" });

        expect(tagService.resolveConnections).not.toHaveBeenCalled();
        expect(db.entry.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ tags: undefined }) }),
        );
      });

      it("does not call tagService.resolveConnections when tags is an empty array", async () => {
        const db = createFakeDb();
        const tagService = createFakeTagService();
        const service = new TaskService(db, tagService);

        await service.create({ title: "Buy milk", tags: [] });

        expect(tagService.resolveConnections).not.toHaveBeenCalled();
        expect(db.entry.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ tags: undefined }) }),
        );
      });

      it("resolves tags and connects them when tags is non-empty", async () => {
        const db = createFakeDb();
        const tagService = createFakeTagService([{ id: "tag-1" }]);
        const service = new TaskService(db, tagService);

        await service.create({ title: "Buy milk", tags: ["urgent"] });

        expect(tagService.resolveConnections).toHaveBeenCalledWith(["urgent"]);
        expect(db.entry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ tags: { connect: [{ id: "tag-1" }] } }),
          }),
        );
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

    it("leaves notes untouched (passes undefined) when notes is omitted", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.update("1", { title: "New title" });

      expect(db.entry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: undefined }) }),
      );
    });

    it("clears existing notes when notes is null", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.update("1", { notes: null });

      expect(db.entry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: null }) }),
      );
    });

    it("clears existing notes when notes is an empty string (post-trim)", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.update("1", { notes: "" });

      expect(db.entry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: null }) }),
      );
    });

    it("sets a new notes value when notes is a non-empty string", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new TaskService(db);

      await service.update("1", { notes: "Updated notes" });

      expect(db.entry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: "Updated notes" }) }),
      );
    });

    describe("tags", () => {
      it("does not call tagService.resolveConnections when tags is omitted, leaving existing associations untouched", async () => {
        const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
        const tagService = createFakeTagService();
        const service = new TaskService(db, tagService);

        await service.update("1", { title: "New title" });

        expect(tagService.resolveConnections).not.toHaveBeenCalled();
        expect(db.entry.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ tags: undefined }) }),
        );
      });

      it("calls tagService.resolveConnections with [] and explicitly clears all tags when tags is an empty array", async () => {
        const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
        const tagService = createFakeTagService([]);
        const service = new TaskService(db, tagService);

        await service.update("1", { tags: [] });

        expect(tagService.resolveConnections).toHaveBeenCalledWith([]);
        expect(db.entry.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ tags: { set: [] } }) }),
        );
      });

      it("resolves and sets the given tags when tags is a non-empty array", async () => {
        const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
        const tagService = createFakeTagService([{ id: "tag-1" }, { id: "tag-2" }]);
        const service = new TaskService(db, tagService);

        await service.update("1", { tags: ["urgent", "home"] });

        expect(tagService.resolveConnections).toHaveBeenCalledWith(["urgent", "home"]);
        expect(db.entry.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tags: { set: [{ id: "tag-1" }, { id: "tag-2" }] },
            }),
          }),
        );
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
