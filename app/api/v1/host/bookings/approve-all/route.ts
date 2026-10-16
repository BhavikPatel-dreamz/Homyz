import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";

// POST /api/v1/host/bookings/approve-all — confirm the authenticated host's pending future bookings.
export const POST = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  return ok(await bookingService.approveAllPendingForHost(actor));
});
