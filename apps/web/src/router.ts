import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootRoute } from "./routes/root-route";
import { TasksPage } from "./routes/tasks-page";
import { UiDemoPage } from "./routes/ui-demo-page";

const rootRoute = createRootRoute({
  component: RootRoute,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TasksPage,
});

// Dev-only demo route: only added to the route tree when running the dev server
// (`import.meta.env.DEV`), so it's dead-code-eliminated from production builds and never
// reachable in production. See `tickets/component-library-setup/plan.md` §3.4.
const devRoutes = import.meta.env.DEV
  ? [
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/dev/ui",
        component: UiDemoPage,
      }),
    ]
  : [];

const routeTree = rootRoute.addChildren([tasksRoute, ...devRoutes]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
