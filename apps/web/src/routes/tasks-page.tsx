import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../trpc";
import { LoadingState } from "../components/ui/loading-state";
import { EmptyState } from "../components/ui/empty-state";
import { TaskCreateForm } from "./task-create-form";
import { TaskListItem } from "./task-list-item";

export function TasksPage() {
  const trpc = useTRPC();
  const { data, isLoading, isError } = useQuery(trpc.tasks.list.queryOptions());
  // isLoading/isError below stay keyed off tasks.list only — a slow/failed
  // tag-suggestions fetch shouldn't block or error out the whole task list;
  // TagInput degrades gracefully with an empty/stale suggestions array either way.
  const { data: tagsData } = useQuery(trpc.tags.list.queryOptions());
  const tagSuggestions = (tagsData ?? []).map((tag) => tag.name);

  return (
    <>
      <TaskCreateForm tagSuggestions={tagSuggestions} />
      {isLoading && <LoadingState label="Loading tasks…" />}
      {isError && <p>Something went wrong loading tasks.</p>}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState title="No tasks yet" />
      )}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul>
          {data.map((task) => (
            <TaskListItem key={task.id} task={task} tagSuggestions={tagSuggestions} />
          ))}
        </ul>
      )}
    </>
  );
}
