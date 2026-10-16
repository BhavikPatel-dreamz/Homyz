import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { refundService } from "@/services/refund.service";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const guestRefundRequestSchema = z.object({
  amount: z.number().int().positive("Refund amount must be a positive integer in minor units."),
  reason: z.string().min(5, "A reason of at least 5 characters is required."),
  idempotencyKey: z.string().optional(),
});

/**
 * GET /api/v1/bookings/[id]/refund
 * Returns refund history and status for a specific reservation (Guest & Admin).
 */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      payments: {
        select: {
          id: true,
          status: true,
          amount: true,
          capturedAmount: true,
          refundedAmount: true,
          currency: true,
        },
      },
      refunds: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          refundReference: true,
          status: true,
          amount: true,
          currency: true,
          reason: true,
          failureReason: true,
          createdAt: true,
          processedAt: true,
          succeededAt: true,
        },
      },
    },
  });

  if (!booking) throw AppError.notFound("Booking not found");

  if (actor.role !== "ADMIN" && actor.id !== booking.userId) {
    throw AppError.forbidden("You do not have permission to view refunds for this reservation.");
  }

  const primaryPayment = booking.payments[0] || null;
  const capturedAmount = primaryPayment?.capturedAmount ?? 0;
  const refundedAmount = primaryPayment?.refundedAmount ?? 0;
  const remainingRefundable = Math.max(0, capturedAmount - refundedAmount);

  return ok({
    bookingId: booking.id,
    currency: booking.currency,
    capturedAmount,
    refundedAmount,
    remainingRefundable,
    refunds: booking.refunds,
  });
});

/**
 * POST /api/v1/bookings/[id]/refund
 * Allows an authenticated guest to request a refund for their reservation.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const body = guestRefundRequestSchema.parse(await req.json());

  const refund = await refundService.createRefundRequest(actor, {
    bookingId: id,
    amount: body.amount,
    reason: body.reason,
    idempotencyKey: body.idempotencyKey,
  });

  return ok({
    success: true,
    message: "Refund request submitted successfully. It will be reviewed by our team.",
    refund,
  });
});

