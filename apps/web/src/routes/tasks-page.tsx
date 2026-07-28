import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../trpc";
import { Section } from "../components/ui/section";
import { Panel } from "../components/ui/panel";
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
    <Section title="Tasks">
      <Panel title="Add a task">
        <TaskCreateForm tagSuggestions={tagSuggestions} />
      </Panel>
      {isLoading && <p className="text-ink/60">Loading tasks…</p>}
      {isError && <p className="text-ink/60">Something went wrong loading tasks.</p>}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <p className="text-ink/60">No tasks yet</p>
      )}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((task) => (
            <TaskListItem key={task.id} task={task} tagSuggestions={tagSuggestions} />
          ))}
        </ul>
      )}
    </Section>
  );
}
