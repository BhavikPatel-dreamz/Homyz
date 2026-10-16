import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/admin/bookings/[id]/activity
 * Returns audit trail activity specifically for a given booking.
 */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.ACTIVITY_LOGS_VIEW]);
  const { id } = await ctx.params;
  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));

  const result = await bookingService.getAdminBookingActivity(actor, id, { page, limit });
  return ok(result);
});
