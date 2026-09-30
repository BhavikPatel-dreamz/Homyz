import { z } from "zod";
import { HOST_MESSAGE_MAX_LENGTH } from "@/lib/booking/host-message";

export const createBookingSchema = z
  .object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.number().int().min(1).max(50).optional().default(1),
    pets: z.number().int().min(0).max(20).optional(),
    nonRefundable: z.boolean().optional().default(false),
    message: z.string().trim().min(1, "Please write a message to the host.").max(HOST_MESSAGE_MAX_LENGTH).optional(),
    // This is a payment-timing intent snapshot only. No option implies that a
    // payment was authorized, captured, or scheduled by a provider.
    paymentPlan: z.enum(["FULL", "SPLIT", "PAY_OVER_TIME"]).optional(),
    // No provider/tokenization path exists yet. Reject UI-only method names.
    paymentMethod: z.never().optional(),
    specialOfferId: z.string().optional(),
    requestSubmissionId: z.string().uuid().optional(),
    expectedGuestTotal: z.number().int().nonnegative().optional(),
    expectedCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  })
  .refine((obj) => obj.endDate > obj.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const requestToBookSchema = z
  .object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.number().int().min(1).max(50),
    adults: z.number().int().min(1).max(50),
    children: z.number().int().min(0).max(50),
    infants: z.number().int().min(0).max(5),
    pets: z.number().int().min(0).max(20).optional().default(0),
    nonRefundable: z.boolean().optional().default(false),
    message: z.string().trim().min(1).max(HOST_MESSAGE_MAX_LENGTH),
    paymentPlan: z.enum(["FULL", "SPLIT", "PAY_OVER_TIME"]),
    specialOfferId: z.string().optional(),
    requestSubmissionId: z.string().uuid(),
    expectedGuestTotal: z.number().int().nonnegative(),
    expectedCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  })
  .strict()
  .refine((obj) => obj.endDate > obj.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type RequestToBookInput = z.infer<typeof requestToBookSchema>;

export const quoteBookingSchema = z
  .object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.coerce.number().int().min(1).max(50).optional().default(1),
    pets: z.coerce.number().int().min(0).max(20).optional(),
    nonRefundable: z.preprocess((value) => value === "true" || value === true, z.boolean()).optional().default(false),
    specialOfferId: z.string().optional(),
  })
  .refine((obj) => obj.endDate > obj.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type QuoteBookingInput = z.infer<typeof quoteBookingSchema>;
