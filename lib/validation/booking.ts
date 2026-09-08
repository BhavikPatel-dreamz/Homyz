import { z } from "zod";

export const createBookingSchema = z
  .object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.number().int().min(1).max(50).optional().default(1),
  })
  .refine((obj) => obj.endDate > obj.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const quoteBookingSchema = z
  .object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.coerce.number().int().min(1).max(50).optional().default(1),
  })
  .refine((obj) => obj.endDate > obj.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type QuoteBookingInput = z.infer<typeof quoteBookingSchema>;

