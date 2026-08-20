import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../trpc";
import { TextInput } from "../components/ui/text-input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { parseQuickAdd } from "../lib/quick-add-parse";
import { wireDateTimeStringFromDate } from "../lib/task-due-date";

export function TaskCreateForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [rawInput, setRawInput] = useState("");

  const parsed = useMemo(() => parseQuickAdd(rawInput), [rawInput]);

  const createMutation = useMutation(
    trpc.tasks.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.tasks.list.queryKey() });
        setRawInput("");
      },
    }),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (parsed.title === "") return;

    createMutation.mutate({
      title: parsed.title,
      dueDate: parsed.dueDate
        ? wireDateTimeStringFromDate(parsed.dueDate, parsed.dueDateHasTime)
        : undefined,
      tags: parsed.tags.length > 0 ? parsed.tags : undefined,
    });
  }

  const hasPreview = Boolean(parsed.dueDate) || parsed.tags.length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <TextInput
        aria-label="Task title"
        placeholder='Add a task… try "tomorrow 5pm #chores"'
        required
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
      />
      {hasPreview && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {parsed.dueDate && (
            <p>
              Due{" "}
              {parsed.dueDateHasTime
                ? parsed.dueDate.toLocaleString()
                : parsed.dueDate.toLocaleDateString()}
            </p>
          )}
          {parsed.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {parsed.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      )}
      <Button type="submit" disabled={createMutation.isPending}>
        Add task
      </Button>
      {createMutation.isError && <p>{createMutation.error.message}</p>}
    </form>
  );
}
