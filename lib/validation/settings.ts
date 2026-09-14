import { z } from "zod";

export const updateHostServiceFeeSchema = z.object({
  percentage: z
    .number()
    .min(0, "Fee percentage must be at least 0%")
    .max(100, "Fee percentage cannot exceed 100%"),
});

export type UpdateHostServiceFeeInput = z.infer<typeof updateHostServiceFeeSchema>;

