import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";
import { refundApprovalSchema } from "@/lib/validation/admin-booking";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admin/bookings/refunds/[id]/approve
 * Approves a pending refund request.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_MANAGE);
  const { id } = await ctx.params;

  let body: { notes?: string } = {};
  try {
    body = refundApprovalSchema.parse(await req.json());
  } catch {
    // Empty body is valid
  }

  const refund = await refundService.approveRefund(actor, id, body.notes);
  return ok({
    success: true,
    message: "Refund request approved successfully.",
    refund,
  });
});
