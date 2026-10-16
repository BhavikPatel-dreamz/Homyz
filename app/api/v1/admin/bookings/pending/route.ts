import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/pending
 * Returns top pending booking requests awaiting host approval with authoritative 24h deadlines.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 5));

  const items = await bookingService.getAdminPendingRequests(actor, limit);
  return ok(items);
});

