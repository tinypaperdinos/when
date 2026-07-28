import { z } from "zod";
import { wireDateTimeString } from "./schema-helpers";

export const taskCreateInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  dueDate: wireDateTimeString.optional(),
  notes: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export const taskUpdateFields = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  dueDate: wireDateTimeString.nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export const taskToggleCompleteFields = z.object({
  completed: z.boolean(),
});

export type TaskCreateInput = z.infer<typeof taskCreateInput>;
export type TaskUpdateInput = z.infer<typeof taskUpdateFields>;
