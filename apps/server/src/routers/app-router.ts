import { router } from "../trpc";
import { tasksRouter } from "./task-router";
import { eventsRouter } from "./event-router";

export const appRouter = router({
  tasks: tasksRouter,
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;
