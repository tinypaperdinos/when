import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { RouterProvider } from "@tanstack/react-router";
import type { AppRouter } from "server";
import { TRPCProvider } from "../trpc";
import { router } from "../router";

// Coverage for the nav's active-link state, called out in
// tickets/design-consistency-theme-tokens/plan.md §3. `RootRoute`'s "/" link sets
// `activeOptions={{ exact: true }}` defensively (TanStack Router's segment-boundary
// path matching already keeps it from activating on `/calendar` without it, but
// `exact: true` also pins search-param matching, which matters if `/` ever gains
// query params). These tests render through the app's real `router` export (the
// same instance `main.tsx` passes to `RouterProvider`), not a bare
// `render(<RootRoute />)`, since the active-link hook needs a real router context.

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

// Both TasksPage and CalendarPage fire batched tRPC list queries on mount; this
// stub answers any batched request with an empty array per requested procedure so
// either route renders past its loading state. The nav's active-link state doesn't
// depend on what the routed page renders, so the page content itself isn't asserted.
function emptyListFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = decodeURIComponent(url).match(/\/trpc\/([^?]+)/);
    const paths = match ? match[1].split(",") : [];
    return jsonResponse(paths.map(() => ({ result: { data: [] } })));
  }) as unknown as typeof fetch;
}

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/trpc", fetch: emptyListFetch() })],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <RouterProvider router={router} />
      </TRPCProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RootRoute nav active-link matching", () => {
  it("marks Tasks active and Calendar inactive on the root route", async () => {
    await router.navigate({ to: "/" });
    renderApp();

    const tasksLink = await screen.findByRole("link", { name: "Tasks" });
    const calendarLink = screen.getByRole("link", { name: "Calendar" });

    await waitFor(() => expect(tasksLink).toHaveClass("border-accent"));
    expect(calendarLink).not.toHaveClass("border-accent");
  });

  it("marks Calendar active and Tasks inactive on /calendar", async () => {
    await router.navigate({ to: "/calendar" });
    renderApp();

    const tasksLink = await screen.findByRole("link", { name: "Tasks" });
    const calendarLink = screen.getByRole("link", { name: "Calendar" });

    await waitFor(() => expect(calendarLink).toHaveClass("border-accent"));
    expect(tasksLink).not.toHaveClass("border-accent");
  });
});
