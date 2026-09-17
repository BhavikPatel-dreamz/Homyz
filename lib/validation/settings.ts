import { z } from "zod";

export const updateHostServiceFeeSchema = z.object({
  percentage: z
    .number()
    .min(0, "Fee percentage must be at least 0%")
    .max(100, "Fee percentage cannot exceed 100%"),
});

export type UpdateHostServiceFeeInput = z.infer<typeof updateHostServiceFeeSchema>;

export const updateNonRefundableDiscountSchema = z.object({
  percentage: z.number().gt(0, "Discount percentage must be greater than 0%").max(100, "Discount percentage cannot exceed 100%"),
});

export const updateHomepagePopularHomesConfigSchema = z.object({
  mode: z.enum(["STATIC", "USER_LOCATION", "USER_IP"]).default("STATIC"),
  city: z
    .string()
    .trim()
    .max(100, "City name is too long")
    .transform((value) => value || "Riyadh")
    .default("Riyadh"),
  title: z
    .string()
    .trim()
    .max(120, "Section title is too long")
    .transform((value) => value || "Popular homes")
    .default("Popular homes"),
  enabled: z.boolean().default(true),
});
