import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { TaskService } from "../services/task-service";

export const tasksRouter = router({
  list: publicProcedure.query(() => new TaskService(db).list()),
});
