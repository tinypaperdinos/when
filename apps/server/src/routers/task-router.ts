import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { TaskService } from "../services/task-service";
import { idInput } from "../services/schema-helpers";
import {
  taskCreateInput,
  taskUpdateFields,
  taskToggleCompleteFields,
} from "../services/task-schema";

const updateInput = idInput.merge(taskUpdateFields);
const toggleCompleteInput = idInput.merge(taskToggleCompleteFields);

export const tasksRouter = router({
  list: publicProcedure.query(() => new TaskService(db).list()),

  create: publicProcedure
    .input(taskCreateInput)
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
