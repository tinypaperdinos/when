import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { TagService } from "./tag-service";

function createFakeDb(overrides: {
  findManyResult?: unknown[];
  createResult?: unknown;
} = {}) {
  return {
    tag: {
      findMany: vi.fn().mockResolvedValue(overrides.findManyResult ?? []),
      create: vi.fn().mockImplementation(({ data }: { data: { name: string } }) =>
        Promise.resolve(overrides.createResult ?? { id: `id-${data.name}`, name: data.name }),
      ),
    },
  } as unknown as PrismaClient;
}

describe("TagService", () => {
  describe("list", () => {
    it("returns [] when there are no tags", async () => {
      const db = createFakeDb({ findManyResult: [] });
      const service = new TagService(db);

      const result = await service.list();

      expect(result).toEqual([]);
    });

    it("returns whatever db.tag.findMany resolves with, ordered by name", async () => {
      const rows = [{ id: "1", name: "urgent" }];
      const db = createFakeDb({ findManyResult: rows });
      const service = new TagService(db);

      const result = await service.list();

      expect(result).toBe(rows);
      expect(db.tag.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
    });
  });

  describe("resolveConnections", () => {
    it("returns [] without calling db.tag.findMany when given an empty array", async () => {
      const db = createFakeDb();
      const service = new TagService(db);

      const result = await service.resolveConnections([]);

      expect(result).toEqual([]);
      expect(db.tag.findMany).not.toHaveBeenCalled();
    });

    it("reuses an existing tag's id when a name case-insensitively matches", async () => {
      const db = createFakeDb({ findManyResult: [{ id: "existing-1", name: "urgent" }] });
      const service = new TagService(db);

      const result = await service.resolveConnections(["URGENT"]);

      expect(result).toEqual([{ id: "existing-1" }]);
      expect(db.tag.create).not.toHaveBeenCalled();
    });

    it("creates a new tag preserving the input's casing when there's no match", async () => {
      const db = createFakeDb({ findManyResult: [{ id: "existing-1", name: "urgent" }] });
      const service = new TagService(db);

      const result = await service.resolveConnections(["Work"]);

      expect(db.tag.create).toHaveBeenCalledWith({ data: { name: "Work" } });
      expect(result).toEqual([{ id: "id-Work" }]);
    });

    it("de-dupes case-variant names within the same call to a single connection", async () => {
      const db = createFakeDb({ findManyResult: [] });
      const service = new TagService(db);

      const result = await service.resolveConnections(["Work", "work"]);

      expect(db.tag.create).toHaveBeenCalledTimes(1);
      expect(db.tag.create).toHaveBeenCalledWith({ data: { name: "Work" } });
      expect(result).toHaveLength(1);
    });

    it("resolves a mix of one matching and one new name correctly in the same call", async () => {
      const db = createFakeDb({ findManyResult: [{ id: "existing-1", name: "urgent" }] });
      const service = new TagService(db);

      const result = await service.resolveConnections(["urgent", "home"]);

      expect(db.tag.create).toHaveBeenCalledTimes(1);
      expect(db.tag.create).toHaveBeenCalledWith({ data: { name: "home" } });
      expect(result).toEqual([{ id: "existing-1" }, { id: "id-home" }]);
    });

    it("matches on .toLowerCase() only — does not re-trim, trimming happens upstream in the router's Zod schema", async () => {
      const db = createFakeDb({ findManyResult: [{ id: "existing-1", name: "urgent" }] });
      const service = new TagService(db);

      const result = await service.resolveConnections(["URGENT"]);

      expect(result).toEqual([{ id: "existing-1" }]);
    });
  });
});
