import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/admin/bookings/refunds/[id]
 * Returns authoritative refund request details, booking context, payment records, and audit events.
 */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_VIEW);
  const { id } = await ctx.params;
  const details = await refundService.getRefundDetailsForAdmin(actor, id);
  return ok(details);
});
