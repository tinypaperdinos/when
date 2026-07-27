import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { EventService } from "../services/event-service";

const eventDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid date");

const createInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  date: eventDateString,
  notes: z.string().trim().optional(),
});

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").optional(),
  date: eventDateString.optional(),
  notes: z.string().trim().nullable().optional(),
});

const idInput = z.object({ id: z.string().min(1) });

export const eventsRouter = router({
  list: publicProcedure.query(() => new EventService(db).list()),

  create: publicProcedure
    .input(createInput)
    .mutation(({ input }) => new EventService(db).create(input)),

  update: publicProcedure.input(updateInput).mutation(({ input }) => {
    const { id, ...rest } = input;
    return new EventService(db).update(id, rest);
  }),

  delete: publicProcedure
    .input(idInput)
    .mutation(({ input }) => new EventService(db).delete(input.id)),
});
