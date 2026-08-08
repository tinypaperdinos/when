import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventDropArg } from "@fullcalendar/core";
import { useTRPC } from "../trpc";
import { calendarEntries, buildRescheduleMutationArgs } from "../lib/calendar-events";
import { useUpdateTaskMutation, useUpdateEventMutation } from "../lib/task-event-mutations";
import { Section } from "../components/ui/section";

export function CalendarPage() {
  const trpc = useTRPC();
  const tasksQuery = useQuery(trpc.tasks.list.queryOptions());
  const eventsQuery = useQuery(trpc.events.list.queryOptions());
  const [dragError, setDragError] = useState<string | null>(null);

  const events = useMemo(
    () => calendarEntries(tasksQuery.data, eventsQuery.data),
    [tasksQuery.data, eventsQuery.data],
  );

  const updateTask = useUpdateTaskMutation();
  const updateEvent = useUpdateEventMutation();

  function handleEventDrop(info: EventDropArg) {
    setDragError(null);

    if (!info.event.start) {
      info.revert();
      return;
    }

    const kind = info.event.extendedProps.kind as "task" | "event";
    const args = buildRescheduleMutationArgs(
      info.event.id,
      kind,
      info.event.start,
      info.event.allDay,
    );
    const onError = (err: { message: string }) => {
      info.revert();
      setDragError(err.message);
    };

    if (args.kind === "task") {
      updateTask.mutate(args.payload, { onError });
    } else {
      updateEvent.mutate(args.payload, { onError });
    }
  }

  const isLoading = tasksQuery.isLoading || eventsQuery.isLoading;
  const isError = tasksQuery.isError || eventsQuery.isError;

  return (
    <Section title="Calendar">
      {isLoading && <p>Loading calendar…</p>}
      {isError && <p>Something went wrong loading the calendar.</p>}
      {dragError && <p>Couldn&apos;t reschedule: {dragError}</p>}
      {!isLoading && !isError && (
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          editable
          eventDurationEditable={false}
          events={events}
          eventDrop={handleEventDrop}
          eventClassNames={(arg) =>
            arg.event.extendedProps.completed ? ["line-through"] : []
          }
        />
      )}
    </Section>
  );
}
