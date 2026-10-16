import { z } from "zod";

const bookingIdSchema = z.string().min(1).max(128);
export const createRefundRequestSchema = z
  .object({
    bookingId: bookingIdSchema,
    amount: z.number().int().positive().max(100_000_000),
    reason: z.string().trim().min(1).max(2_000),
    notes: z.string().trim().max(5_000).optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export const refundProcessSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export const refundApprovalSchema = z
  .object({ notes: z.string().trim().max(5_000).optional() })
  .strict();

export const refundRejectionSchema = z
  .object({ reason: z.string().trim().min(1).max(2_000) })
  .strict();
