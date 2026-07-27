import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export class TaskService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.entry.findMany({
      where: { kind: "task" },
      orderBy: { dueDate: "asc" },
    });
  }

  private async assertTaskExists(id: string) {
    const existing = await this.db.entry.findUnique({ where: { id } });
    if (!existing || existing.kind !== "task") {
      throw new TRPCError({ code: "NOT_FOUND", message: `Task ${id} not found` });
    }
  }

  async create(input: { title: string; dueDate?: string; notes?: string }) {
    return this.db.entry.create({
      data: {
        kind: "task",
        title: input.title,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        notes: input.notes ? input.notes : undefined,
      },
    });
  }

  async update(
    id: string,
    input: { title?: string; dueDate?: string | null; notes?: string | null },
  ) {
    await this.assertTaskExists(id);
    return this.db.entry.update({
      where: { id },
      data: {
        title: input.title,
        dueDate:
          input.dueDate === undefined
            ? undefined
            : input.dueDate === null
              ? null
              : new Date(input.dueDate),
        notes: input.notes === undefined ? undefined : input.notes || null,
      },
    });
  }

  async toggleComplete(id: string, completed: boolean) {
    await this.assertTaskExists(id);
    return this.db.entry.update({ where: { id }, data: { completed } });
  }

  async delete(id: string) {
    await this.assertTaskExists(id);
    await this.db.entry.delete({ where: { id } });
    return { id };
  }
}
