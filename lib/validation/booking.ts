import { z } from "zod";

export const createBookingSchema = z
  .object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.number().int().min(1).max(50).optional().default(1),
    pets: z.number().int().min(0).max(20).optional(),
    nonRefundable: z.boolean().optional().default(false),
    message: z.string().optional(),
    paymentPlan: z.enum(["FULL", "SPLIT", "KLARNA"]).optional(),
    paymentMethod: z.enum(["CARD", "APPLE_PAY", "GOOGLE_PAY", "LOCAL"]).optional(),
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
    pets: z.coerce.number().int().min(0).max(20).optional(),
    nonRefundable: z.preprocess((value) => value === "true" || value === true, z.boolean()).optional().default(false),
  })
  .refine((obj) => obj.endDate > obj.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type QuoteBookingInput = z.infer<typeof quoteBookingSchema>;
