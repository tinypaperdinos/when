import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { EventService } from "./event-service";

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

describe("EventService", () => {
  describe("list", () => {
    it("filters to kind: event, excluding tasks", async () => {
      const db = createFakeDb({ findManyResult: [] });
      const service = new EventService(db);

      await service.list();

      expect(db.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kind: "event" },
          orderBy: { date: "asc" },
        }),
      );
    });

    it("returns whatever the db resolves with, unmodified", async () => {
      const rows = [{ id: "1", title: "Team standup" }];
      const db = createFakeDb({ findManyResult: rows });
      const service = new EventService(db);

      const result = await service.list();

      expect(result).toBe(rows);
    });

    it("returns [] when there are no matching rows", async () => {
      const db = createFakeDb({ findManyResult: [] });
      const service = new EventService(db);

      const result = await service.list();

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("passes the title through unchanged — trimming happens upstream in the router's Zod schema, tested in event-router.test.ts", async () => {
      const db = createFakeDb();
      const service = new EventService(db);

      await service.create({ title: "  Team standup  ", date: "2026-07-26" });

      expect(db.entry.create).toHaveBeenCalledWith({
        data: {
          kind: "event",
          title: "  Team standup  ",
          date: new Date("2026-07-26"),
          notes: undefined,
        },
      });
    });

    it("always passes kind: 'event' regardless of anything else in the input", async () => {
      const db = createFakeDb();
      const service = new EventService(db);

      await service.create({ title: "Team standup", date: "2026-07-26" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ kind: "event" }) }),
      );
    });

    it("converts a date-only date string into a real Date before the db call", async () => {
      const db = createFakeDb();
      const service = new EventService(db);

      await service.create({ title: "Team standup", date: "2026-07-26" });

      expect(db.entry.create).toHaveBeenCalledWith({
        data: {
          kind: "event",
          title: "Team standup",
          date: new Date("2026-07-26"),
          notes: undefined,
        },
      });
    });

    it("converts a date+time date string into a real Date before the db call", async () => {
      const db = createFakeDb();
      const service = new EventService(db);

      await service.create({ title: "Team standup", date: "2026-07-26T14:30" });

      expect(db.entry.create).toHaveBeenCalledWith({
        data: {
          kind: "event",
          title: "Team standup",
          date: new Date("2026-07-26T14:30"),
          notes: undefined,
        },
      });
    });

    it("stores an undefined notes (Prisma persists it as null) when notes is omitted", async () => {
      const db = createFakeDb();
      const service = new EventService(db);

      await service.create({ title: "Team standup", date: "2026-07-26" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: undefined }) }),
      );
    });

    it("stores notes unchanged when provided", async () => {
      const db = createFakeDb();
      const service = new EventService(db);

      await service.create({
        title: "Team standup",
        date: "2026-07-26",
        notes: "Bring laptop",
      });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: "Bring laptop" }) }),
      );
    });

    it("normalizes a whitespace-only notes value to undefined rather than storing an empty string", async () => {
      const db = createFakeDb();
      const service = new EventService(db);

      await service.create({ title: "Team standup", date: "2026-07-26", notes: "" });

      expect(db.entry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: undefined }) }),
      );
    });
  });

  describe("update", () => {
    it("throws NOT_FOUND for an unknown id", async () => {
      const db = createFakeDb({ findUniqueResult: null });
      const service = new EventService(db);

      await expect(service.update("missing", { title: "New title" })).rejects.toThrow(
        TRPCError,
      );
      await expect(service.update("missing", { title: "New title" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when the id exists but is a task, not an event", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new EventService(db);

      await expect(service.update("1", { title: "New title" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.entry.update).not.toHaveBeenCalled();
    });

    it("leaves date and notes untouched (passes undefined) on a title-only update", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new EventService(db);

      await service.update("1", { title: "New title" });

      expect(db.entry.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: "New title", date: undefined, notes: undefined },
      });
    });

    it("converts and replaces the existing date when date is a valid string", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new EventService(db);

      await service.update("1", { date: "2026-08-01" });

      expect(db.entry.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: undefined, date: new Date("2026-08-01"), notes: undefined },
      });
    });

    it("leaves notes untouched (passes undefined) when notes is omitted", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new EventService(db);

      await service.update("1", { title: "New title" });

      expect(db.entry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: undefined }) }),
      );
    });

    it("clears existing notes when notes is null", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new EventService(db);

      await service.update("1", { notes: null });

      expect(db.entry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: null }) }),
      );
    });

    it("sets a new notes value when notes is a non-empty string", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new EventService(db);

      await service.update("1", { notes: "Updated notes" });

      expect(db.entry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: "Updated notes" }) }),
      );
    });
  });

  describe("delete", () => {
    it("throws NOT_FOUND for an unknown id", async () => {
      const db = createFakeDb({ findUniqueResult: null });
      const service = new EventService(db);

      await expect(service.delete("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND when the id exists but is a task", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "task" } });
      const service = new EventService(db);

      await expect(service.delete("1")).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(db.entry.delete).not.toHaveBeenCalled();
    });

    it("calls db.entry.delete with { where: { id } } and resolves to { id }", async () => {
      const db = createFakeDb({ findUniqueResult: { id: "1", kind: "event" } });
      const service = new EventService(db);

      const result = await service.delete("1");

      expect(db.entry.delete).toHaveBeenCalledWith({ where: { id: "1" } });
      expect(result).toEqual({ id: "1" });
    });
  });
});
