import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootRoute } from "./routes/root-route";
import { TasksPage } from "./routes/tasks-page";

const rootRoute = createRootRoute({
  component: RootRoute,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TasksPage,
});

const routeTree = rootRoute.addChildren([tasksRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
