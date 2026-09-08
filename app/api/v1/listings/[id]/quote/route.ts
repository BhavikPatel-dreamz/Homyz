import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { quoteBookingSchema } from "@/lib/validation/booking";
import { bookingService } from "@/services/booking.service";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id]/quote?checkIn=...&checkOut=...&guests=...
// Authoritative price quote calculator for guest marketplace.
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const searchParams = req.nextUrl.searchParams;

  const parsed = quoteBookingSchema.parse({
    listingId: id,
    startDate: searchParams.get("checkIn") || searchParams.get("startDate"),
    endDate: searchParams.get("checkOut") || searchParams.get("endDate"),
    guests: searchParams.get("guests") || 1,
  });

  const quote = await bookingService.getBookingQuote({
    listingId: parsed.listingId,
    checkIn: parsed.startDate,
    checkOut: parsed.endDate,
    guests: parsed.guests,
  });

  return ok(quote);
});
