import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { quoteBookingSchema } from "@/lib/validation/booking";
import { bookingService } from "@/services/booking.service";
import { getAuthContext } from "@/lib/auth/context";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id]/quote?checkIn=...&checkOut=...&guests=...&specialOfferId=...
// Authoritative price quote calculator for guest marketplace.
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const searchParams = req.nextUrl.searchParams;
  const actor = await getAuthContext(req);

  const parsed = quoteBookingSchema.parse({
    listingId: id,
    startDate: searchParams.get("checkIn") || searchParams.get("startDate") || searchParams.get("checkin"),
    endDate: searchParams.get("checkOut") || searchParams.get("endDate") || searchParams.get("checkout"),
    guests: searchParams.get("guests") || 1,
    pets: searchParams.get("pets") || 0,
    nonRefundable: searchParams.get("nonRefundable") || false,
    specialOfferId: searchParams.get("specialOfferId") || undefined,
  });

  const quote = await bookingService.getBookingQuote({
    listingId: parsed.listingId,
    checkIn: parsed.startDate,
    checkOut: parsed.endDate,
    guests: parsed.guests,
    pets: parsed.pets,
    nonRefundable: parsed.nonRefundable,
    specialOfferId: parsed.specialOfferId,
    actor: actor || undefined,
  });

  return ok(quote);
});
