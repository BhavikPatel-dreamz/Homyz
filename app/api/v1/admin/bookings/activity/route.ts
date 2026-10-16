import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/activity
 * Returns recent recorded booking activity events from AuditLog.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));

  const items = await bookingService.getAdminRecentActivity(actor, limit);
  return ok(items);
});

