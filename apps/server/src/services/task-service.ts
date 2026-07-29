import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { TaskCreateInput, TaskUpdateInput } from "./task-schema";
import { TagService } from "./tag-service";

export class TaskService {
  // Second constructor param is new for this codebase — no existing service currently
  // composes another service. Defaulted so routers keep calling `new TaskService(db)`
  // unchanged, while tests can inject a fake TagService instead of mocking db.tag.
  constructor(
    private readonly db: PrismaClient,
    private readonly tagService: TagService = new TagService(db),
  ) {}

  list() {
    return this.db.entry.findMany({
      where: { kind: "task" },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      include: { tags: true },
    });
  }

  private async assertTaskExists(id: string) {
    const existing = await this.db.entry.findUnique({ where: { id } });
    if (!existing || existing.kind !== "task") {
      throw new TRPCError({ code: "NOT_FOUND", message: `Task ${id} not found` });
    }
  }

  async create(input: TaskCreateInput) {
    const tagConnections =
      input.tags && input.tags.length > 0
        ? await this.tagService.resolveConnections(input.tags)
        : [];

    return this.db.entry.create({
      data: {
        kind: "task",
        title: input.title,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        notes: input.notes ? input.notes : undefined,
        tags: tagConnections.length > 0 ? { connect: tagConnections } : undefined,
      },
    });
  }

  async update(id: string, input: TaskUpdateInput) {
    await this.assertTaskExists(id);

    const tags =
      input.tags === undefined
        ? undefined
        : { set: await this.tagService.resolveConnections(input.tags) };

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
        tags,
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
