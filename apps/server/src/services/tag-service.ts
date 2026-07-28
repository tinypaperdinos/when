import type { PrismaClient } from "@prisma/client";

export class TagService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    // Case-sensitive ASCII ordering — a direct consequence of resolveConnections'
    // case-preserving storage (see tickets/tags/plan.md §2.3): "Work" sorts before
    // "urgent". Not a bug; a portable case-insensitive orderBy isn't available without
    // a SQLite-specific collation, which was deliberately ruled out.
    return this.db.tag.findMany({ orderBy: { name: "asc" } });
  }

  // Resolves already-validated (trimmed, non-empty per task-schema.ts) tag names into
  // { id } connect-refs for an Entry.tags write. Case-insensitively matches existing
  // tags (reusing the existing row's id/casing); unmatched names are created fresh,
  // preserving the caller's casing. De-dupes the input list the same way. See
  // tickets/tags/plan.md §2.3 for the reasoning and the known concurrent-create limitation.
  async resolveConnections(names: string[]): Promise<{ id: string }[]> {
    // A plain `new Set(names)` dedupes case-sensitively, so "Work" and "work" would
    // both survive — the Set here tracks lowercased keys instead, to dedupe the same
    // way resolveConnections matches against existing tags, while still preserving
    // the first-seen casing in `deduped`.
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const name of names) {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(name);
      }
    }
    if (deduped.length === 0) return [];

    const existing = await this.db.tag.findMany();
    const connections: { id: string }[] = [];
    for (const name of deduped) {
      const match = existing.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (match) {
        connections.push({ id: match.id });
      } else {
        const created = await this.db.tag.create({ data: { name } });
        connections.push({ id: created.id });
        existing.push(created); // later names in this same call see it too
      }
    }
    return connections;
  }
}
