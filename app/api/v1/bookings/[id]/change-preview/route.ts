import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { bookingService } from "@/services/booking.service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/bookings/[id]/change-preview — Check availability and recalculate quote
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const preview = await bookingService.changeBookingReservationPreview(actor, id, {
    startDate: body.startDate,
    endDate: body.endDate,
    guests: body.guests ? Number(body.guests) : undefined,
  });
  return ok(preview);
});

