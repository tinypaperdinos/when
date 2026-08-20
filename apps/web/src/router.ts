import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootRoute } from "./routes/root-route";
import { TasksPage } from "./routes/tasks-page";
import { CalendarPage } from "./routes/calendar-page";
import { UiDemoPage } from "./routes/ui-demo-page";
import { DesignExplorePage } from "./routes/design-explore-page";

const rootRoute = createRootRoute({
  component: RootRoute,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TasksPage,
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  component: CalendarPage,
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
      // Scratch design exploration, not a real route — see design-explore-page.tsx.
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/dev/design-explore",
        component: DesignExplorePage,
      }),
    ]
  : [];

const routeTree = rootRoute.addChildren([tasksRoute, calendarRoute, ...devRoutes]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
