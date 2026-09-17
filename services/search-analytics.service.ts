import { getCache, setCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";

export type SearchAnalyticsEvent = {
  destination?: string | null;
  destinationType?: string | null;
  city?: string | null;
  country?: string | null;
  placeName?: string | null;
  lat?: number | null;
  lng?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guestCount?: number;
  timestamp: string;
  resultCount?: number;
};

export async function trackHomepageSearchEvent(
  event: SearchAnalyticsEvent,
): Promise<void> {
  const safeDestination = typeof event.destination === "string"
    ? event.destination.trim().slice(0, 120) || null
    : null;

  const safeEvent: SearchAnalyticsEvent = {
    destination: safeDestination,
    destinationType: typeof event.destinationType === "string" ? event.destinationType.slice(0, 60) : null,
    city: typeof event.city === "string" ? event.city.trim().slice(0, 80) : null,
    country: typeof event.country === "string" ? event.country.trim().slice(0, 80) : null,
    placeName: typeof event.placeName === "string" ? event.placeName.trim().slice(0, 120) : null,
    lat: typeof event.lat === "number" && Number.isFinite(event.lat) ? Number(event.lat.toFixed(5)) : null,
    lng: typeof event.lng === "number" && Number.isFinite(event.lng) ? Number(event.lng.toFixed(5)) : null,
    checkIn: typeof event.checkIn === "string" && event.checkIn ? event.checkIn.slice(0, 20) : null,
    checkOut: typeof event.checkOut === "string" && event.checkOut ? event.checkOut.slice(0, 20) : null,
    guestCount: Number.isFinite(event.guestCount) ? Math.max(1, Number(event.guestCount)) : 1,
    timestamp: event.timestamp || new Date().toISOString(),
    resultCount: typeof event.resultCount === "number" && Number.isFinite(event.resultCount) ? Math.max(0, Math.trunc(event.resultCount)) : undefined,
  };

  const key = CACHE_KEYS.SEARCH_ANALYTICS();
  const existing = (await getCache<SearchAnalyticsEvent[]>(key)) ?? [];
  const next = [safeEvent, ...existing].slice(0, 200);
  await setCache(key, next, 7 * 24 * 60 * 60);
}
