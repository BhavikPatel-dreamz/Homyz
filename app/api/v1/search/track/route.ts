import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { trackHomepageSearchEvent } from "@/services/search-analytics.service";

export const runtime = "nodejs";

export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const payload = body && typeof body === "object" ? body : {};

  const guestCount = Number(payload.guestCount ?? 1);
  const safePayload = {
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
  };

  await trackHomepageSearchEvent(safePayload);
  return ok({ ok: true, stored: true });
});
