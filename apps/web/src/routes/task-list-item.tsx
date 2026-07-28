import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../trpc";
import type { Task } from "../trpc";
import { useUpdateTaskMutation } from "../lib/task-event-mutations";
import { Checkbox } from "../components/ui/checkbox";
import { TextInput } from "../components/ui/text-input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { TagInput } from "../components/ui/tag-input";
import { cn } from "../lib/cn";

export function TaskListItem({
  task,
  tagSuggestions = [],
}: {
  task: Task;
  tagSuggestions?: string[];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNotes, setEditNotes] = useState(task.notes ?? "");
  const [editTags, setEditTags] = useState<string[]>(
    task.tags?.map((tag) => tag.name) ?? [],
  );

  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: trpc.tasks.list.queryKey() });
  }

  const toggleCompleteMutation = useMutation(
    trpc.tasks.toggleComplete.mutationOptions({
      onSuccess: invalidateList,
    }),
  );

  const updateMutation = useUpdateTaskMutation(() => setIsEditing(false));

  const deleteMutation = useMutation(
    trpc.tasks.delete.mutationOptions({
      onSuccess: invalidateList,
    }),
  );

  function handleEditClick() {
    setEditTitle(task.title);
    setEditNotes(task.notes ?? "");
    setEditTags(task.tags?.map((tag) => tag.name) ?? []);
    setIsEditing(true);
  }

  function handleSave() {
    updateMutation.mutate({
      id: task.id,
      title: editTitle.trim(),
      notes: editNotes.trim() || null,
      tags: editTags,
    });
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
        <Textarea
          aria-label="Edit task notes"
          value={editNotes}
          onChange={(event) => setEditNotes(event.target.value)}
        />
        <TagInput
          value={editTags}
          onChange={setEditTags}
          suggestions={tagSuggestions}
          label="Edit task tags"
        />
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
      {task.notes && <p className="whitespace-pre-wrap">{task.notes}</p>}
      {(task.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(task.tags ?? []).map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
        </div>
      )}
      {toggleCompleteMutation.isError && (
        <p>Couldn&apos;t update task: {toggleCompleteMutation.error.message}</p>
      )}
      {deleteMutation.isError && (
        <p>Couldn&apos;t delete task: {deleteMutation.error.message}</p>
      )}
    </li>
  );
}
