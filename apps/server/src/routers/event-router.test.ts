import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();

vi.mock("../db", () => ({
  db: {
    entry: { findMany, findUnique, create, update, delete: del },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("eventsRouter", () => {
  it("wires the router to EventService.list() via createCaller", async () => {
    const rows = [{ id: "1", title: "Team standup", kind: "event" }];
    findMany.mockResolvedValue(rows);

    const { appRouter } = await import("./app-router");
    const caller = appRouter.createCaller({});

    const result = await caller.events.list();

    expect(result).toBe(rows);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: "event" } }),
    );
  });

  it("has no toggleComplete procedure — events have no completion state", async () => {
    const { eventsRouter } = await import("./event-router");

    expect("toggleComplete" in eventsRouter).toBe(false);
  });

  describe("create", () => {
    it("wires the router to EventService.create() via createCaller", async () => {
      const row = { id: "1", title: "Team standup", kind: "event" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      const result = await caller.events.create({
        title: "Team standup",
        date: "2026-07-26",
      });

      expect(result).toBe(row);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: "event", title: "Team standup" }),
        }),
      );
    });

    it("rejects an empty title", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.create({ title: "", date: "2026-07-26" }),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only title", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.create({ title: "   ", date: "2026-07-26" }),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a missing date", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.create({ title: "Team standup" } as never),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a malformed date string", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.create({ title: "Team standup", date: "07/26/2026" }),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    });

    it("trims a padded title before it reaches EventService.create", async () => {
      const row = { id: "1", title: "Team standup", kind: "event" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.events.create({ title: "  Team standup  ", date: "2026-07-26" });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: "Team standup" }),
        }),
      );
    });

    it("trims a padded notes value before it reaches EventService.create", async () => {
      const row = { id: "1", title: "Team standup", kind: "event" };
      create.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await caller.events.create({
        title: "Team standup",
        date: "2026-07-26",
        notes: "  Bring laptop  ",
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: "Bring laptop" }),
        }),
      );
    });
  });

  describe("update", () => {
    it("wires the router to EventService.update() via createCaller", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "event" });
      const row = { id: "1", title: "New title", kind: "event" };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      const result = await caller.events.update({ id: "1", title: "New title" });

      expect(result).toBe(row);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ title: "New title" }),
        }),
      );
    });

    it("rejects a malformed date string", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.update({ id: "1", date: "07/26/2026" }),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only title when provided", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.update({ id: "1", title: "   " }),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });

    it("accepts notes: null and passes it through as a clear", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "event", notes: "Existing notes" });
      const row = { id: "1", title: "Team standup", kind: "event", notes: null };
      update.mockResolvedValue(row);

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.update({ id: "1", notes: null }),
      ).resolves.toBe(row);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
          data: expect.objectContaining({ notes: null }),
        }),
      );
    });

    it("rejects date: null — unlike task's dueDate, an event's date is not nullable", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(
        caller.events.update({ id: "1", date: null } as never),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("wires the router to EventService.delete() via createCaller", async () => {
      findUnique.mockResolvedValue({ id: "1", kind: "event" });
      del.mockResolvedValue({ id: "1" });

      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      const result = await caller.events.delete({ id: "1" });

      expect(result).toEqual({ id: "1" });
      expect(del).toHaveBeenCalledWith({ where: { id: "1" } });
    });

    it("rejects an empty id", async () => {
      const { appRouter } = await import("./app-router");
      const caller = appRouter.createCaller({});

      await expect(caller.events.delete({ id: "" })).rejects.toThrow();
      expect(del).not.toHaveBeenCalled();
    });
  });
});
