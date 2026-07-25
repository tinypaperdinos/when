import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../trpc";

export function TasksPage() {
  const trpc = useTRPC();
  const { data, isLoading, isError } = useQuery(trpc.tasks.list.queryOptions());

  if (isLoading) {
    return <p>Loading tasks…</p>;
  }

  if (isError) {
    return <p>Something went wrong loading tasks.</p>;
  }

  if (!data || data.length === 0) {
    return <p>No tasks yet</p>;
  }

  return (
    <ul>
      {data.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  );
}
