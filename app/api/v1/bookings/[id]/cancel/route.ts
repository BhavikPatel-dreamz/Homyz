import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { bookingService } from "@/services/booking.service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/bookings/[id]/cancel — guest booking cancellation.
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const booking = await bookingService.cancelBookingByGuest(actor, id);
  return ok(booking);
});
