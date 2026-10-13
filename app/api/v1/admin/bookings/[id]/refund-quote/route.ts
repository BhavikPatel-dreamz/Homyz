import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admin/bookings/[id]/refund-quote
 * Computes a read-only refund calculation and eligibility preview without mutating records.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_VIEW);
  const { id } = await ctx.params;

  let body: { discretionaryAmount?: number; discretionaryReason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is valid
  }

  const quote = await refundService.getRefundQuote(actor, id, {
    discretionaryAmount: body.discretionaryAmount,
    discretionaryReason: body.discretionaryReason,
  });

  return ok(quote);
});
