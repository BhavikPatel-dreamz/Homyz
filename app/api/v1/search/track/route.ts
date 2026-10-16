import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { trackHomepageSearchEvent, saveUserRecentSearch } from "@/services/search-analytics.service";
import { getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const payload = body && typeof body === "object" ? body : {};

  const guestCount = Number(payload.guestCount ?? 1);
  const safePayload = {
    eventType: typeof payload.eventType === "string" ? payload.eventType : (payload.destination || payload.city ? "search" : "unknown"),
    propertyId: typeof payload.propertyId === "string" ? payload.propertyId : null,
    action: typeof payload.action === "string" ? payload.action : null,
    filterKey: typeof payload.filterKey === "string" ? payload.filterKey : null,
    sortOption: typeof payload.sortOption === "string" ? payload.sortOption : null,
    destination: typeof payload.destination === "string" ? payload.destination : null,
    destinationType: typeof payload.destinationType === "string" ? payload.destinationType : null,
    city: typeof payload.city === "string" ? payload.city : null,
    country: typeof payload.country === "string" ? payload.country : null,
    placeName: typeof payload.placeName === "string" ? payload.placeName : null,
    lat: typeof payload.lat === "number" && Number.isFinite(payload.lat) ? payload.lat : null,
    lng: typeof payload.lng === "number" && Number.isFinite(payload.lng) ? payload.lng : null,
    checkIn: typeof payload.checkIn === "string" ? payload.checkIn : null,
    checkOut: typeof payload.checkOut === "string" ? payload.checkOut : null,
    guestCount: Number.isFinite(guestCount) ? Math.max(1, Math.round(guestCount)) : 1,
    timestamp: typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString(),
    resultCount: typeof payload.resultCount === "number" && Number.isFinite(payload.resultCount) ? Math.max(0, Math.trunc(payload.resultCount)) : undefined,
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : null,
  };

  await trackHomepageSearchEvent(safePayload);

  // If user is authenticated, save search history to user account in Redis
  try {
    const user = await getSessionUser();
    if (user?.id) {
      await saveUserRecentSearch(user.id, safePayload);
    }
  } catch {}

  return ok({ ok: true, stored: true });
});
