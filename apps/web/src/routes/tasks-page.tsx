import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../trpc";
import { TaskCreateForm } from "./task-create-form";
import { TaskListItem } from "./task-list-item";

export function TasksPage() {
  const trpc = useTRPC();
  const { data, isLoading, isError } = useQuery(trpc.tasks.list.queryOptions());

  return (
    <>
      <TaskCreateForm />
      {isLoading && <p>Loading tasks…</p>}
      {isError && <p>Something went wrong loading tasks.</p>}
      {!isLoading && !isError && (!data || data.length === 0) && <p>No tasks yet</p>}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul>
          {data.map((task) => (
            <TaskListItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </>
  );
}
