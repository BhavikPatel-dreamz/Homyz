import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admin/bookings/[id]/cancel
 * Authoritative administrative cancellation action endpoint.
 * Requires BOOKINGS_CANCEL permission, updates status, frees inventory, and records audit logs.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_CANCEL);
  const { id } = await ctx.params;

  let body: { reason?: string; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    throw AppError.badRequest("Invalid request body. JSON object expected.");
  }

  const reason = (body.reason || "").trim();
  if (!reason) {
    throw AppError.badRequest("A valid cancellation reason is required.");
  }

  const notes = body.notes ? body.notes.trim() : undefined;
  const booking = await bookingService.cancelBookingByAdmin(actor, id, reason, notes);

  return ok({
    success: true,
    message: "Reservation cancelled successfully by administrator.",
    booking,
  });
});

