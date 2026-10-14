import { z } from "zod";
export { planRequestSchema } from "@homeflow/shared";

export const idParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});
