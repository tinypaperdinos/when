import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../trpc";
import { TextInput } from "../components/ui/text-input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { DateTimePicker, type DateTimePickerValue } from "../components/ui/date-time-picker";
import { dueDatePayload } from "../lib/task-due-date";

export function TaskCreateForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [dueDateValue, setDueDateValue] = useState<DateTimePickerValue>({ date: "" });
  const [notes, setNotes] = useState("");

  const createMutation = useMutation(
    trpc.tasks.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.tasks.list.queryKey() });
        setTitle("");
        setDueDateValue({ date: "" });
        setNotes("");
      },
    }),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    createMutation.mutate({
      title: trimmedTitle,
      dueDate: dueDatePayload(dueDateValue),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <TextInput
        aria-label="Task title"
        placeholder="Add a task…"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <DateTimePicker
        value={dueDateValue}
        onChange={setDueDateValue}
        dateLabel="Due date"
      />
      <Textarea
        aria-label="Task notes"
        placeholder="Notes…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Button type="submit" disabled={createMutation.isPending}>
        Add task
      </Button>
      {createMutation.isError && <p>{createMutation.error.message}</p>}
    </form>
  );
}
