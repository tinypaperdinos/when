import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();
const tagFindMany = vi.fn();
const tagCreate = vi.fn();

vi.mock("../db", () => ({
  db: {
    entry: { findMany, findUnique, create, update, delete: del },
    tag: { findMany: tagFindMany, create: tagCreate },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

  describe("create", () => {
    it("wires the router to TaskService.create() via createCaller", async () => {
      const row = { id: "1", title: "Buy milk", kind: "task" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      const result = await caller.tasks.create({ title: "Buy milk" });

      expect(result).toBe(row);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: "task", title: "Buy milk" }),
        }),
      );
    });

    it("rejects an empty title", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(caller.tasks.create({ title: "" })).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only title", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(caller.tasks.create({ title: "   " })).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("trims a padded title before it reaches TaskService.create", async () => {
      const row = { id: "1", title: "Buy milk", kind: "task" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.tasks.create({ title: "  Buy milk  " });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: "Buy milk" }),
        }),
      );
    });

    it("trims a padded notes value before it reaches TaskService.create", async () => {
      const row = { id: "1", title: "Buy milk", kind: "task" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.tasks.create({ title: "Buy milk", notes: "  Get oat milk  " });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: "Get oat milk" }),
        }),
      );
    });

    it("does not reject an empty-string notes value on create, unlike title", async () => {
      const row = { id: "1", title: "Buy milk", kind: "task" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.create({ title: "Buy milk", notes: "" }),
      ).resolves.toBe(row);
    });

    it("does not reject a whitespace-only notes value on create, unlike title", async () => {
      const row = { id: "1", title: "Buy milk", kind: "task" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.create({ title: "Buy milk", notes: "   " }),
      ).resolves.toBe(row);
    });

    it("rejects a malformed dueDate string", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.create({ title: "Buy milk", dueDate: "07/26/2026" }),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects an empty-string entry inside tags", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.create({ title: "Buy milk", tags: [""] }),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
      expect(tagCreate).not.toHaveBeenCalled();
      expect(tagFindMany).not.toHaveBeenCalled();
    });

    it("rejects a non-array tags value", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.create({ title: "Buy milk", tags: "urgent" } as never),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("resolves and connects tags end-to-end for a valid tags array", async () => {
      tagFindMany.mockResolvedValue([]);
      tagCreate.mockResolvedValue({ id: "tag-1", name: "urgent" });
      const row = { id: "1", title: "Buy milk", kind: "task" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.tasks.create({ title: "Buy milk", tags: ["urgent"] });

      expect(tagCreate).toHaveBeenCalledWith({ data: { name: "urgent" } });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: { connect: [{ id: "tag-1" }] } }),
        }),
      );
    });
  });

  describe("update", () => {
    it("wires the router to TaskService.update() via createCaller", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task" });
      const row = { id: "1", title: "New title", kind: "task" };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      const result = await caller.tasks.update({ id: "1", title: "New title" });

      expect(result).toBe(row);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ title: "New title" }),
        }),
      );
    });

    it("rejects a malformed dueDate string", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.update({ id: "1", dueDate: "07/26/2026" }),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only title", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.update({ id: "1", title: "   " }),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });

    it("trims a padded title before it reaches TaskService.update", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task" });
      const row = { id: "1", title: "New title", kind: "task" };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.tasks.update({ id: "1", title: "  New title  " });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ title: "New title" }),
        }),
      );
    });

    it("trims a padded notes value before it reaches TaskService.update", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task" });
      const row = { id: "1", title: "Buy milk", kind: "task" };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.tasks.update({ id: "1", notes: "  Updated notes  " });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ notes: "Updated notes" }),
        }),
      );
    });

    it("does not reject an empty-string or whitespace-only notes value on update, unlike title", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task" });
      const row = { id: "1", title: "Buy milk", kind: "task" };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(caller.tasks.update({ id: "1", notes: "" })).resolves.toBe(row);
      await expect(caller.tasks.update({ id: "1", notes: "   " })).resolves.toBe(row);
    });

    it("accepts notes: null and clears existing notes via TaskService.update", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task", notes: "Existing notes" });
      const row = { id: "1", title: "Buy milk", kind: "task", notes: null };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.update({ id: "1", notes: null }),
      ).resolves.toBe(row);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ notes: null }),
        }),
      );
    });

    it("accepts dueDate: null and clears the existing due date via TaskService.update", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task", dueDate: new Date("2026-07-26") });
      const row = { id: "1", title: "Buy milk", kind: "task", dueDate: null };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.update({ id: "1", dueDate: null }),
      ).resolves.toBe(row);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ dueDate: null }),
        }),
      );
    });

    it("rejects an empty-string entry inside tags", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.update({ id: "1", tags: [""] }),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
      expect(tagCreate).not.toHaveBeenCalled();
      expect(tagFindMany).not.toHaveBeenCalled();
    });

    it("rejects a non-array tags value", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.update({ id: "1", tags: "urgent" } as never),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });

    it("sends tags: { set: [] } end-to-end when tags is an empty array", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task" });
      tagFindMany.mockResolvedValue([]);
      const row = { id: "1", title: "Buy milk", kind: "task" };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.tasks.update({ id: "1", tags: [] });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ tags: { set: [] } }),
        }),
      );
    });
  });

  describe("toggleComplete", () => {
    it("wires the router to TaskService.toggleComplete() via createCaller", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task" });
      const row = { id: "1", completed: true, kind: "task" };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      const result = await caller.tasks.toggleComplete({ id: "1", completed: true });

      expect(result).toBe(row);
      expect(update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { completed: true },
      });
    });

    it("rejects a missing completed value", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.tasks.toggleComplete({ id: "1" } as never),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("wires the router to TaskService.delete() via createCaller", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "task" });
      del.mockResolvedValue({ id: "1" });

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      const result = await caller.tasks.delete({ id: "1" });

      expect(result).toEqual({ id: "1" });
      expect(del).toHaveBeenCalledWith({ where: { id: "1" } });
    });

    it("rejects an empty id", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(caller.tasks.delete({ id: "" })).rejects.toThrow();
      expect(del).not.toHaveBeenCalled();
    });
  });
});
