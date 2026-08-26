import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  // Price in minor units (e.g. cents) per night.
  price: z.number().int().positive(),
  published: z.boolean().optional().default(false),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No fields to update",
  });
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
