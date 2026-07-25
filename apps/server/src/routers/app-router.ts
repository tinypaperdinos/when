import { router } from "../trpc";
import { tasksRouter } from "./task-router";

export const appRouter = router({
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
