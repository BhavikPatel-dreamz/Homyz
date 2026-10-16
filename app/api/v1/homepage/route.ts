import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { homepageService } from "@/services/homepage.service";

// Public, cache-backed discovery data. This intentionally contains no private
// user state; bookings are revalidated by bookingService before confirmation.
export const GET = apiHandler(async (req) => {
  const city = req.nextUrl.searchParams.get("city") || req.nextUrl.searchParams.get("destination") || undefined;
  return ok(await homepageService.getHomepageData({ city }));
});
