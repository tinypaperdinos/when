import { z } from "zod";
import { wireDateTimeString } from "./schema-helpers";

export const eventCreateInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  date: wireDateTimeString,
  notes: z.string().trim().optional(),
});

export const eventUpdateFields = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  date: wireDateTimeString.optional(),
  notes: z.string().trim().nullable().optional(),
});

export type EventCreateInput = z.infer<typeof eventCreateInput>;
export type EventUpdateInput = z.infer<typeof eventUpdateFields>;
