import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { quoteBookingSchema } from "@/lib/validation/booking";
import { bookingService } from "@/services/booking.service";
import { getAuthContext } from "@/lib/auth/context";
import { getStayEliteCheckoutEligibility } from "@/services/stayelite-checkout-eligibility.service";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id]/quote?checkIn=...&checkOut=...&guests=...&specialOfferId=...
// Authoritative price quote calculator for guest marketplace.
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const searchParams = req.nextUrl.searchParams;
  // Standard marketplace quotes are public and do not need an auth lookup.
  // Resolving the development fallback user here added an avoidable database
  // round-trip to every date change. Special offers still require the caller
  // context because their guest/host authorization is validated server-side.
  const specialOfferId = searchParams.get("specialOfferId") || undefined;
  const actor = await getAuthContext(req);

  const parsed = quoteBookingSchema.parse({
    listingId: id,
    startDate: searchParams.get("checkIn") || searchParams.get("startDate") || searchParams.get("checkin"),
    endDate: searchParams.get("checkOut") || searchParams.get("endDate") || searchParams.get("checkout"),
    guests: searchParams.get("guests") || 1,
    pets: searchParams.get("pets") || 0,
    nonRefundable: searchParams.get("nonRefundable") || false,
    specialOfferId,
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

  // Eligibility metadata is intentionally non-financial while commercial
  // decisions remain blocked; quote totals always remain pricing-service only.
  const stayElite = actor ? await getStayEliteCheckoutEligibility(actor.id, quote.nights) : undefined;
  return ok({ ...quote, ...(stayElite ? { stayElite } : {}) });
});
