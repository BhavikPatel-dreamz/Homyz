import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/cancellations/summary
 * Returns authoritative KPI metrics for Admin Cancellation Management.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const summary = await bookingService.getCancellationSummaryForAdmin(actor);
  return ok(summary);
});

