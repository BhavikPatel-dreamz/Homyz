import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/refunds/summary
 * Returns 8 aggregate KPI metrics for Admin Refund Management.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_VIEW);
  const summary = await refundService.getRefundSummaryForAdmin(actor);
  return ok(summary);
});
