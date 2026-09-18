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

const USER_SEARCHES_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const globalForUserSearches = globalThis as unknown as {
  __homyzUserRecentSearches?: Map<string, { data: any[]; expiresAt: number }>;
};

const userSearchesMemory = (globalForUserSearches.__homyzUserRecentSearches ??= new Map());

export async function getUserRecentSearches(userId: string): Promise<any[]> {
  if (!userId) return [];
  try {
    const key = CACHE_KEYS.USER_RECENT_SEARCHES(userId);
    const cached = await getCache<any[]>(key);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached.slice(0, 4);
    }
  } catch {}

  // Graceful fallback to memory store if Redis is unconfigured or empty
  const mem = userSearchesMemory.get(userId);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data.slice(0, 4);
  }
  return [];
}

export async function saveUserRecentSearch(
  userId: string,
  search: Record<string, any>,
): Promise<void> {
  if (!userId || !search) return;
  const locKey = (search.city || search.displayName || search.destination || search.query || "").trim().toLowerCase();
  if (!locKey || locKey === "stays" || locKey === "all") return;

  try {
    const existing = await getUserRecentSearches(userId);
    const filtered = existing.filter((s) => {
      const k = (s.city || s.displayName || s.destination || s.query || "").trim().toLowerCase();
      if (locKey === k) return false;
      if (search.city && s.city && search.city.trim().toLowerCase() === s.city.trim().toLowerCase()) return false;
      if (search.query && s.query && search.query.trim().toLowerCase() === s.query.trim().toLowerCase()) return false;
      return true;
    });

    const updated = [
      {
        query: search.destination || search.query || search.city || locKey,
        displayName: search.destination || search.displayName || search.city || locKey,
        placeType: search.destinationType || search.placeType || "general",
        city: search.city || null,
        country: search.country || null,
        latitude: typeof search.lat === "number" ? search.lat : search.latitude ?? null,
        longitude: typeof search.lng === "number" ? search.lng : search.longitude ?? null,
        checkIn: search.checkIn || null,
        checkOut: search.checkOut || null,
        guests: typeof search.guestCount === "number" ? search.guestCount : search.guests ?? 1,
        savedAt: new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, 4);

    const key = CACHE_KEYS.USER_RECENT_SEARCHES(userId);
    await setCache(key, updated, USER_SEARCHES_TTL_SECONDS);
    userSearchesMemory.set(userId, {
      data: updated,
      expiresAt: Date.now() + USER_SEARCHES_TTL_SECONDS * 1000,
    });
  } catch (error) {
    console.error("Failed to save user recent search to Redis:", error);
  }
}

