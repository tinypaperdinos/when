import { Link, Outlet } from "@tanstack/react-router";

export function RootRoute() {
  return (
    <>
      <nav className="flex gap-4">
        <Link to="/">Tasks</Link>
        <Link to="/calendar">Calendar</Link>
      </nav>
      {import.meta.env.DEV && (
        <p>
          <Link to="/dev/ui">UI component library (dev only)</Link>
        </p>
      )}
      <Outlet />
    </>
  );
}
