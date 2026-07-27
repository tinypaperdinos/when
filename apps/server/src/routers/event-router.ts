import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { EventService } from "../services/event-service";
import { idInput } from "../services/schema-helpers";
import { eventCreateInput, eventUpdateFields } from "../services/event-schema";

const updateInput = idInput.merge(eventUpdateFields);

export const eventsRouter = router({
  list: publicProcedure.query(() => new EventService(db).list()),

  create: publicProcedure
    .input(eventCreateInput)
    .mutation(({ input }) => new EventService(db).create(input)),

  update: publicProcedure.input(updateInput).mutation(({ input }) => {
    const { id, ...rest } = input;
    return new EventService(db).update(id, rest);
  }),

  delete: publicProcedure
    .input(idInput)
    .mutation(({ input }) => new EventService(db).delete(input.id)),
});
