import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/admin/bookings/[id]
 * Authoritative admin booking details endpoint, with sensitive arrival credentials sanitized.
 */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const { id } = await ctx.params;
  const details = await bookingService.getAdminBookingDetails(actor, id);
  return ok(details);
});

