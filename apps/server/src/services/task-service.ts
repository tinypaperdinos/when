import type { PrismaClient } from "@prisma/client";

export class TaskService {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.entry.findMany({
      where: { kind: "task" },
      orderBy: { dueDate: "asc" },
    });
  }
}
