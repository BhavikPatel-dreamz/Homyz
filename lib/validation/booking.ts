import { z } from "zod";

export const createBookingSchema = z
  .object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((obj) => obj.endDate > obj.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
