import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { bookingService } from "@/services/booking.service";
import { refundService } from "@/services/refund.service";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/bookings/[id]/cancel — guest cancellation refund preview.
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const quote = await refundService.getRefundQuote(actor, id);
  return ok({
    bookingId: id,
    cancellationPolicy: quote.policyUsed,
    policyVersion: quote.policyVersion,
    milestoneApplied: quote.milestoneApplied,
    hoursUntilCheckIn: quote.hoursUntilCheckIn,
    isPastCheckIn: quote.isPastCheckIn,
    totalCaptured: quote.capturedAmount,
    alreadyRefunded: quote.alreadyRefundedAmount,
    remainingBalance: quote.remainingRefundableBalance,
    estimatedRefund: quote.totalRefundableAmount,
    breakdown: {
      accommodationRefund: quote.accommodationRefund,
      cleaningFeeRefund: quote.cleaningFeeRefund,
      serviceFeeRefund: quote.serviceFeeRefund,
      taxRefund: quote.taxRefund,
    },
    currency: quote.currency,
    destination: "Original payment method",
    processingTime: "5–10 business days",
    explanation: quote.explanation,
    status: quote.status,
  });
});

// POST /api/v1/bookings/[id]/cancel — guest booking cancellation.
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const booking = await bookingService.cancelBookingByGuest(actor, id);
  return ok(booking);
});
