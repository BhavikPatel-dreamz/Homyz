import { getCache, setCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";

export type SearchAnalyticsEvent = {
  eventType?: string | null;
  propertyId?: string | null;
  action?: string | null;
  filterKey?: string | null;
  sortOption?: string | null;
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
  metadata?: Record<string, unknown> | null;
};

export type StoredUserSearch = {
  query: string;
  displayName: string;
  placeType: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  savedAt: string;
  /** Bounded count of meaningful submitted searches for this destination. */
  searchCount?: number;
  /** Used only for user-scoped affinity ranking; never exposed publicly. */
  lastSearchedAt?: string;
};

type UserSearchInput = {
  query?: string | null;
  destination?: string | null;
  displayName?: string | null;
  destinationType?: string | null;
  placeType?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guestCount?: number | null;
  guests?: number | null;
};

const INTEREST_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DESTINATION_SEARCH_COUNT = 25;
const DUPLICATE_EVENT_WINDOW_MS = 3_000;

/**
 * Frequency has diminishing returns and naturally fades as a destination gets
 * stale. Keeping this pure makes the ranking safe to reuse in a durable store
 * later without changing the homepage contract.
 */
export function calculateSearchInterestScore(
  search: Pick<StoredUserSearch, "searchCount" | "lastSearchedAt" | "savedAt">,
  now = Date.now(),
): number {
  const count = Math.max(1, Math.min(MAX_DESTINATION_SEARCH_COUNT, search.searchCount ?? 1));
  const lastSeen = Date.parse(search.lastSearchedAt || search.savedAt);
  const age = Number.isFinite(lastSeen) ? Math.max(0, now - lastSeen) : INTEREST_HALF_LIFE_MS;
  const recency = Math.exp((-Math.LN2 * age) / INTEREST_HALF_LIFE_MS);
  return Math.log2(count + 1) * recency;
}

export async function trackHomepageSearchEvent(
  event: SearchAnalyticsEvent,
): Promise<void> {
  const safeDestination = typeof event.destination === "string"
    ? event.destination.trim().slice(0, 120) || null
    : null;

  const safeEvent: SearchAnalyticsEvent = {
    eventType: typeof event.eventType === "string" ? event.eventType.slice(0, 50) : null,
    propertyId: typeof event.propertyId === "string" ? event.propertyId.slice(0, 100) : null,
    action: typeof event.action === "string" ? event.action.slice(0, 50) : null,
    filterKey: typeof event.filterKey === "string" ? event.filterKey.slice(0, 50) : null,
    sortOption: typeof event.sortOption === "string" ? event.sortOption.slice(0, 50) : null,
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
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : undefined,
  };

  const key = CACHE_KEYS.SEARCH_ANALYTICS();
  const existing = (await getCache<SearchAnalyticsEvent[]>(key)) ?? [];
  const next = [safeEvent, ...existing].slice(0, 200);
  await setCache(key, next, 7 * 24 * 60 * 60);
}

const USER_SEARCHES_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const globalForUserSearches = globalThis as unknown as {
  __homyzUserRecentSearches?: Map<string, { data: StoredUserSearch[]; expiresAt: number }>;
};

const userSearchesMemory = (globalForUserSearches.__homyzUserRecentSearches ??= new Map());

export async function getUserRecentSearches(userId: string): Promise<StoredUserSearch[]> {
  if (!userId) return [];
  try {
    const key = CACHE_KEYS.USER_RECENT_SEARCHES(userId);
    const cached = await getCache<StoredUserSearch[]>(key);
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

/**
 * Returns the active destination affinity for a signed-in user. It uses only
 * their own submitted search records, is bounded to the existing 30-day
 * retention window, and intentionally does not inspect other users' data.
 */
export async function getUserPrimarySearchInterest(userId: string): Promise<StoredUserSearch | null> {
  const searches = await getUserRecentSearches(userId);
  if (!searches.length) return null;

  return searches
    .map((search, index) => ({ search, index, score: calculateSearchInterestScore(search) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.search ?? null;
}

export async function saveUserRecentSearch(
  userId: string,
  search: UserSearchInput,
): Promise<void> {
  if (!userId || !search) return;
  const locKey = (search.city || search.displayName || search.destination || search.query || "").trim().toLowerCase();
  if (!locKey || locKey === "stays" || locKey === "all") return;

  try {
    const existing = await getUserRecentSearches(userId);
    const existingMatch = existing.find((s) => {
      const k = (s.city || s.displayName || s.query || "").trim().toLowerCase();
      return locKey === k || Boolean(search.city && s.city && search.city.trim().toLowerCase() === s.city.trim().toLowerCase());
    });
    const now = new Date();
    const previousTimestamp = Date.parse(existingMatch?.lastSearchedAt || existingMatch?.savedAt || "");
    const isDuplicateDelivery = Number.isFinite(previousTimestamp) && now.getTime() - previousTimestamp < DUPLICATE_EVENT_WINDOW_MS;
    const previousCount = Math.max(1, Number(existingMatch?.searchCount) || 1);

    const filtered = existing.filter((s) => {
      const k = (s.city || s.displayName || s.query || "").trim().toLowerCase();
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
        savedAt: now.toISOString(),
        searchCount: Math.min(
          MAX_DESTINATION_SEARCH_COUNT,
          previousCount + (existingMatch && !isDuplicateDelivery ? 1 : 0),
        ),
        lastSearchedAt: isDuplicateDelivery
          ? (existingMatch?.lastSearchedAt || existingMatch?.savedAt || now.toISOString())
          : now.toISOString(),
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
