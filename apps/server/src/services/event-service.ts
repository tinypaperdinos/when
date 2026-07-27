import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export class EventService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.entry.findMany({
      where: { kind: "event" },
      orderBy: { date: "asc" },
    });
  }

  private async assertEventExists(id: string) {
    const existing = await this.db.entry.findUnique({ where: { id } });
    if (!existing || existing.kind !== "event") {
      throw new TRPCError({ code: "NOT_FOUND", message: `Event ${id} not found` });
    }
  }

  async create(input: { title: string; date: string; notes?: string }) {
    return this.db.entry.create({
      data: {
        kind: "event",
        title: input.title,
        date: new Date(input.date),
        notes: input.notes ? input.notes : undefined,
      },
    });
  }

  async update(
    id: string,
    input: { title?: string; date?: string; notes?: string | null },
  ) {
    await this.assertEventExists(id);
    return this.db.entry.update({
      where: { id },
      data: {
        title: input.title,
        date: input.date === undefined ? undefined : new Date(input.date),
        notes: input.notes === undefined ? undefined : input.notes || null,
      },
    });
  }

  async delete(id: string) {
    await this.assertEventExists(id);
    await this.db.entry.delete({ where: { id } });
    return { id };
  }
}
