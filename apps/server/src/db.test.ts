import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveDatasourceUrl } from "./db";

describe("resolveDatasourceUrl", () => {
  const baseDir = "/repo/apps/server/src";

  it("resolves a relative file: URL to an absolute path anchored at prisma/", () => {
    const result = resolveDatasourceUrl("file:./dev.db", baseDir);
    const expected = path.resolve(baseDir, "../prisma", "./dev.db");
    expect(result).toBe(`file:${expected}`);
  });

  it("returns an already-absolute file: URL unchanged", () => {
    const result = resolveDatasourceUrl("file:/some/abs/path.db", baseDir);
    expect(result).toBe("file:/some/abs/path.db");
  });

  it("returns a non-sqlite URL unchanged", () => {
    const result = resolveDatasourceUrl(
      "postgresql://user:pass@localhost:5432/db",
      baseDir,
    );
    expect(result).toBe("postgresql://user:pass@localhost:5432/db");
  });

  it("returns undefined when given undefined", () => {
    const result = resolveDatasourceUrl(undefined, baseDir);
    expect(result).toBeUndefined();
  });
});
