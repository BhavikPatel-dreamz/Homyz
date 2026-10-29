import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { bookingService } from "@/services/booking.service";
import { revalidateBookingPaths } from "@/lib/booking/booking-cache-revalidate";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/bookings/[id]/change — Confirms modification of dates / guests
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const updated = await bookingService.changeBookingReservation(actor, id, {
    startDate: body.startDate,
    endDate: body.endDate,
    guests: body.guests ? Number(body.guests) : undefined,
  });
  revalidateBookingPaths(updated.id);
  return ok(updated);
});
