import { z } from "zod";

export const wireDateTimeString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid date");

export const idInput = z.object({ id: z.string().min(1) });
