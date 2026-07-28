import { router } from "../trpc";
import { tasksRouter } from "./task-router";
import { eventsRouter } from "./event-router";
import { tagsRouter } from "./tag-router";

export const appRouter = router({
  tasks: tasksRouter,
  events: eventsRouter,
  tags: tagsRouter,
});

export type AppRouter = typeof appRouter;
