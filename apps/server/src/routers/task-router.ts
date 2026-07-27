import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { TaskService } from "../services/task-service";

const dueDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid date");

const createInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  dueDate: dueDateString.optional(),
});

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").optional(),
  dueDate: dueDateString.nullable().optional(),
});

const idInput = z.object({ id: z.string().min(1) });

const toggleCompleteInput = z.object({
  id: z.string().min(1),
  completed: z.boolean(),
});

export const tasksRouter = router({
  list: publicProcedure.query(() => new TaskService(db).list()),

  create: publicProcedure
    .input(createInput)
    .mutation(({ input }) => new TaskService(db).create(input)),

  update: publicProcedure.input(updateInput).mutation(({ input }) => {
    const { id, ...rest } = input;
    return new TaskService(db).update(id, rest);
  }),

  toggleComplete: publicProcedure
    .input(toggleCompleteInput)
    .mutation(({ input }) =>
      new TaskService(db).toggleComplete(input.id, input.completed),
    ),

  delete: publicProcedure
    .input(idInput)
    .mutation(({ input }) => new TaskService(db).delete(input.id)),
});
