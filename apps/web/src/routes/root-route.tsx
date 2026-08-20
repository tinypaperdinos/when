import { Link, Outlet } from "@tanstack/react-router";

const inactiveLinkClassName = "text-ink/60";
const activeLinkClassName = "border-b-2 border-accent";

export function RootRoute() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header className="flex items-center justify-between border-b-2 border-ink pb-4">
        <h1 className="text-xl font-bold tracking-tight">when// task &amp; calendar</h1>
        <nav className="flex gap-4 text-sm">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: activeLinkClassName }}
            inactiveProps={{ className: inactiveLinkClassName }}
          >
            Tasks
          </Link>
          <Link
            to="/calendar"
            activeProps={{ className: activeLinkClassName }}
            inactiveProps={{ className: inactiveLinkClassName }}
          >
            Calendar
          </Link>
        </nav>
      </header>
      {import.meta.env.DEV && (
        <p className="text-sm text-ink/60">
          <Link to="/dev/ui">UI component library (dev only)</Link>
          {" · "}
          <Link to="/dev/design-explore">Design exploration (dev only)</Link>
        </p>
      )}
      <Outlet />
    </main>
  );
}
