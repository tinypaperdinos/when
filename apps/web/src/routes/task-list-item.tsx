import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../trpc";
import type { Task } from "../trpc";
import { Checkbox } from "../components/ui/checkbox";
import { TextInput } from "../components/ui/text-input";
import { Button } from "../components/ui/button";
import { cn } from "../lib/cn";

export function TaskListItem({ task }: { task: Task }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: trpc.tasks.list.queryKey() });
  }

  const toggleCompleteMutation = useMutation(
    trpc.tasks.toggleComplete.mutationOptions({
      onSuccess: invalidateList,
    }),
  );

  const updateMutation = useMutation(
    trpc.tasks.update.mutationOptions({
      onSuccess: () => {
        invalidateList();
        setIsEditing(false);
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.tasks.delete.mutationOptions({
      onSuccess: invalidateList,
    }),
  );

  function handleEditClick() {
    setEditTitle(task.title);
    setIsEditing(true);
  }

  function handleSave() {
    updateMutation.mutate({ id: task.id, title: editTitle.trim() });
  }

  function handleCancel() {
    setIsEditing(false);
  }

  function handleDelete() {
    if (window.confirm(`Delete task "${task.title}"?`)) {
      deleteMutation.mutate({ id: task.id });
    }
  }

  if (isEditing) {
    return (
      <li className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <TextInput
            aria-label="Edit task title"
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
          />
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
        {updateMutation.isError && (
          <p>Couldn&apos;t save task: {updateMutation.error.message}</p>
        )}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          label={
            <span className={cn(task.completed && "line-through")}>{task.title}</span>
          }
          checked={task.completed ?? false}
          onChange={(event) =>
            toggleCompleteMutation.mutate({ id: task.id, completed: event.target.checked })
          }
        />
        <Button variant="secondary" size="sm" onClick={handleEditClick}>
          Edit
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>
      {task.dueDate && <p>Due {new Date(task.dueDate).toLocaleDateString()}</p>}
      {toggleCompleteMutation.isError && (
        <p>Couldn&apos;t update task: {toggleCompleteMutation.error.message}</p>
      )}
      {deleteMutation.isError && (
        <p>Couldn&apos;t delete task: {deleteMutation.error.message}</p>
      )}
    </li>
  );
}
