import { Link, Outlet } from "@tanstack/react-router";

export function RootRoute() {
  return (
    <>
      {import.meta.env.DEV && (
        <p>
          <Link to="/dev/ui">UI component library (dev only)</Link>
        </p>
      )}
      <Outlet />
    </>
  );
}
