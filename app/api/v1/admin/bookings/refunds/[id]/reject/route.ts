import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";
import { refundRejectionSchema } from "@/lib/validation/admin-booking";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admin/bookings/refunds/[id]/reject
 * Rejects a refund request with a mandatory reason.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_MANAGE);
  const { id } = await ctx.params;

  let body: { reason?: string } = {};
  try {
    body = refundRejectionSchema.parse(await req.json());
  } catch {
    throw AppError.badRequest("JSON request body expected.");
  }

  const reason = (body.reason || "").trim();
  if (!reason) {
    throw AppError.badRequest("A rejection reason is required.");
  }

  const refund = await refundService.rejectRefund(actor, id, reason);
  return ok({
    success: true,
    message: "Refund request rejected successfully.",
    refund,
  });
});
