import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "server";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/trpc",
    }),
  ],
});

// Derived from `AppRouter`'s real inferred output rather than a hand-written
// interface (see AGENT_RULES.md: "never hand-write a manual type for API
// responses"). Reminder: `Task["dueDate"]`'s inferred type is `Date | null`, but
// the runtime value crossing the tRPC boundary is a string (no `superjson`
// transformer configured) — always `new Date(task.dueDate)` before calling any
// `Date` method on it.
export type Task = Awaited<ReturnType<typeof trpcClient.tasks.list.query>>[number];

// Same derivation pattern as `Task` above, and the same runtime-string-despite-inferred-
// `Date`-type rule applies to `EventEntry["date"]`. Named `EventEntry`, not `Event`, to
// avoid shadowing the DOM's global `Event` type in any file that imports it unqualified.
export type EventEntry = Awaited<ReturnType<typeof trpcClient.events.list.query>>[number];
