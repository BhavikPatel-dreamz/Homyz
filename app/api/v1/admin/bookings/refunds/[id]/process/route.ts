import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";
import { refundProcessSchema } from "@/lib/validation/admin-booking";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admin/bookings/refunds/[id]/process
 * Processes an approved refund through the payment provider integration.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_REFUND);
  const { id } = await ctx.params;

  let body: { idempotencyKey?: string } = {};
  try {
    body = refundProcessSchema.parse(await req.json());
  } catch {
    // Empty body is valid
  }

  const refund = await refundService.processRefund(actor, id, body.idempotencyKey);
  return ok({
    success: true,
    message: "Refund processed successfully.",
    refund,
  });
});
