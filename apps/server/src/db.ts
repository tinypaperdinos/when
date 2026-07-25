import { PrismaClient } from "@prisma/client";
import path from "node:path";

// Only rewrite sqlite `file:` URLs to an absolute path — a future Postgres
// DATABASE_URL (e.g. "postgresql://...") is passed through unchanged, so this
// does not undermine the "one-line datasource change in schema.prisma" migration
// path described in AGENT_RULES.md.
export function resolveDatasourceUrl(
  raw: string | undefined,
  baseDir: string = __dirname,
): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/^file:(.+)$/);
  if (!match) return raw;
  const relativePath = match[1];
  if (path.isAbsolute(relativePath)) return raw;
  // Resolve relative to apps/server/prisma/, matching how the Prisma CLI resolves
  // a relative `file:` URL in schema.prisma (relative to schema.prisma's own
  // directory) — anchored to this file's own location, not to node_modules, so
  // npm-workspaces hoisting can't move it out from under us.
  const absolutePath = path.resolve(baseDir, "../prisma", relativePath);
  return `file:${absolutePath}`;
}

export const db = new PrismaClient({
  datasourceUrl: resolveDatasourceUrl(process.env.DATABASE_URL),
});
