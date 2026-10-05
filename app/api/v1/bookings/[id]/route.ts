import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

// GET /api/v1/bookings/[id] — Authoritative booking details for guest, host, or admin
export const GET = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const details = await bookingService.getBookingDetails(actor, id);
  return ok(details);
});

