import type { SearchContext } from "@/lib/location/search-context";

export const RECENT_VIEWED_KEY = "homyz_recently_viewed_properties";
export const RECENT_SEARCHES_KEY = "homyz_recent_search_contexts";
export const LEGACY_RECENT_KEY = "homyz_recent_searches";
export const LAST_SEARCH_KEY = "homyz_last_search_context";
export const LAST_SEARCH_COOKIE = "homyz_last_search";
export const RECENT_SEARCHES_COOKIE = "homyz_recent_searches";
export const MAX_SEARCH_AGE_DAYS = 30;
export const MAX_SEARCH_AGE_MS = MAX_SEARCH_AGE_DAYS * 24 * 60 * 60 * 1000;

export interface ViewedPropertyItem {
  id: string;
  slug?: string | null;
  title: string;
  city?: string | null;
  area?: string | null;
  country?: string | null;
  price: number;
  mainImage: string;
  rating?: number | null;
  maxGuests?: number;
  propertyType?: string | null;
  currency?: string;
  viewedAt: string;
}

export interface StoredSearchContext extends SearchContext {
  savedAt: string;
}

export interface PersistedSearchFilters {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  amenities?: string[];
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  instantBook?: boolean;
  featured?: boolean;
  sortBy?: string;
}

export interface PersistedSearchContext extends SearchContext {
  searchedAt: string; // ISO string
  filters?: PersistedSearchFilters;
}

const MAX_VIEWED = 12;
const MAX_SEARCHES = 8;

/**
 * Validates any raw or persisted search context object against formatting,
 * coordinate bounds, dates, guest counts, and 30-day expiration.
 * Returns a clean, normalized PersistedSearchContext or null if invalid/corrupt.
 */
export function validateSearchContext(raw: unknown): PersistedSearchContext | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;

  const query = typeof obj.query === "string" ? obj.query.trim() : "";
  const displayName = typeof obj.displayName === "string" ? obj.displayName.trim() : query;
  const city = typeof obj.city === "string" ? obj.city.trim() : null;

  const lat =
    typeof obj.latitude === "number" && Number.isFinite(obj.latitude) && Math.abs(obj.latitude) <= 90
      ? obj.latitude
      : null;
  const lng =
    typeof obj.longitude === "number" && Number.isFinite(obj.longitude) && Math.abs(obj.longitude) <= 180
      ? obj.longitude
      : null;

  // Must have either a valid query/city or coordinates
  if (!query && !displayName && !city && (lat === null || lng === null)) {
    return null;
  }

  // Check timestamp & expiration (<= 30 days)
  const searchedAtStr =
    typeof obj.searchedAt === "string"
      ? obj.searchedAt
      : typeof obj.savedAt === "string"
      ? obj.savedAt
      : "";
  const searchedAtTime = searchedAtStr ? new Date(searchedAtStr).getTime() : 0;
  if (!searchedAtTime || isNaN(searchedAtTime)) {
    return null;
  }
  const now = Date.now();
  // Allow small future clock drift (up to 5 mins), reject anything older than 30 days
  if (now - searchedAtTime > MAX_SEARCH_AGE_MS || searchedAtTime > now + 300000) {
    return null;
  }

  // Validate guests
  const guests =
    typeof obj.guests === "number" && Number.isFinite(obj.guests) && obj.guests >= 1
      ? Math.floor(obj.guests)
      : 1;

  // Dates
  const checkIn = typeof obj.checkIn === "string" && obj.checkIn.trim() ? obj.checkIn.trim() : null;
  const checkOut = typeof obj.checkOut === "string" && obj.checkOut.trim() ? obj.checkOut.trim() : null;

  // Place type
  const placeType = typeof obj.placeType === "string" ? obj.placeType : "general";

  return {
    query: query || displayName || city || "Stays",
    displayName: displayName || query || city || "Stays",
    placeId: typeof obj.placeId === "string" ? obj.placeId : null,
    placeType: placeType as any,
    latitude: lat,
    longitude: lng,
    neighborhood: typeof obj.neighborhood === "string" ? obj.neighborhood : null,
    district: typeof obj.district === "string" ? obj.district : null,
    city: city,
    state: typeof obj.state === "string" ? obj.state : null,
    country: typeof obj.country === "string" ? obj.country : null,
    countryCode: typeof obj.countryCode === "string" ? obj.countryCode : null,
    checkIn,
    checkOut,
    guests,
    adults: typeof obj.adults === "number" ? obj.adults : guests,
    children: typeof obj.children === "number" ? obj.children : 0,
    infants: typeof obj.infants === "number" ? obj.infants : 0,
    pets: typeof obj.pets === "number" ? obj.pets : 0,
    radiusKm: typeof obj.radiusKm === "number" ? obj.radiusKm : undefined,
    boundingBox: obj.boundingBox && typeof obj.boundingBox === "object" ? obj.boundingBox : null,
    filters: obj.filters && typeof obj.filters === "object" ? obj.filters : undefined,
    searchedAt: new Date(searchedAtTime).toISOString(),
  };
}

function setClientCookie(name: string, value: string, days = MAX_SEARCH_AGE_DAYS) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteClientCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/**
 * Server-safe parser for reading the lastSearch cookie inside Server Components (e.g. app/page.tsx).
 */
export function parseServerLastSearch(cookieValue?: string | null): PersistedSearchContext | null {
  if (!cookieValue) return null;
  try {
    let unescaped = cookieValue;
    try {
      unescaped = decodeURIComponent(cookieValue);
    } catch {}
    const parsed = JSON.parse(unescaped);
    return validateSearchContext(parsed);
  } catch {
    return null;
  }
}

/**
 * Centralized service to persist the user's latest active search context.
 * Writes to both localStorage and a 30-day cookie (so Next.js SSR can hydrate without flicker),
 * and updates the multi-item search history.
 */
export function saveLastSearch(
  ctx: SearchContext | PersistedSearchContext,
): PersistedSearchContext | null {
  const normalized = validateSearchContext({
    ...ctx,
    searchedAt: (ctx as PersistedSearchContext).searchedAt || new Date().toISOString(),
  });

  if (!normalized) return null;

  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(normalized);
      localStorage.setItem(LAST_SEARCH_KEY, serialized);
      setClientCookie(LAST_SEARCH_COOKIE, serialized, MAX_SEARCH_AGE_DAYS);
    } catch {}
  }

  // Also maintain recent searches history
  saveRecentSearchContext(normalized);

  return normalized;
}

/**
 * Retrieves the currently active last search context.
 * Validates integrity and 30-day expiration. Automatically purges if corrupt.
 */
export function getLastSearch(): PersistedSearchContext | null {
  if (typeof window === "undefined") return null;

  // Try localStorage first
  try {
    const raw = localStorage.getItem(LAST_SEARCH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validated = validateSearchContext(parsed);
      if (validated) {
        // Ensure cookie stays in sync
        setClientCookie(LAST_SEARCH_COOKIE, JSON.stringify(validated), MAX_SEARCH_AGE_DAYS);
        return validated;
      }
      clearLastSearch();
    }
  } catch {
    clearLastSearch();
  }

  // Try cookie fallback
  try {
    const cookieVal = getClientCookie(LAST_SEARCH_COOKIE);
    if (cookieVal) {
      const parsed = JSON.parse(cookieVal);
      const validated = validateSearchContext(parsed);
      if (validated) {
        localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(validated));
        return validated;
      }
      clearLastSearch();
    }
  } catch {
    clearLastSearch();
  }

  return null;
}

/**
 * Completely resets and removes the active homepage search context.
 */
export function clearLastSearch(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LAST_SEARCH_KEY);
      deleteClientCookie(LAST_SEARCH_COOKIE);
    } catch {}
  }
}

// ─────────────────────────────────────────────
// Existing Viewed Properties and Recent Searches
// ─────────────────────────────────────────────

export function getRecentlyViewedProperties(): ViewedPropertyItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_VIEWED) : [];
  } catch {
    return [];
  }
}

export function saveRecentlyViewedProperty(item: Omit<ViewedPropertyItem, "viewedAt">): void {
  if (typeof window === "undefined" || !item?.id) return;
  try {
    const current = getRecentlyViewedProperties().filter((p) => p.id !== item.id);
    const updated: ViewedPropertyItem[] = [
      { ...item, viewedAt: new Date().toISOString() },
      ...current,
    ].slice(0, MAX_VIEWED);
    localStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(updated));
  } catch {}
}

export function getRecentSearchContexts(): StoredSearchContext[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SEARCHES) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearchContext(ctx: SearchContext): void {
  if (typeof window === "undefined" || !ctx?.query) return;
  try {
    const current = getRecentSearchContexts().filter(
      (s) => s.query.toLowerCase() !== ctx.query.toLowerCase(),
    );
    const updated: StoredSearchContext[] = [
      { ...ctx, savedAt: new Date().toISOString() },
      ...current,
    ].slice(0, MAX_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));

    // Sync top 4 recent searches to cookie for SSR hydration
    try {
      setClientCookie(
        RECENT_SEARCHES_COOKIE,
        JSON.stringify(updated.slice(0, 4)),
        MAX_SEARCH_AGE_DAYS,
      );
    } catch {}

    // Also update legacy string searches for backward compatibility
    const legacyRaw = localStorage.getItem(LEGACY_RECENT_KEY);
    const legacy = legacyRaw ? (JSON.parse(legacyRaw) as string[]) : [];
    const legacyFiltered = legacy.filter((s) => s.toLowerCase() !== ctx.query.toLowerCase());
    localStorage.setItem(
      LEGACY_RECENT_KEY,
      JSON.stringify([ctx.query, ...legacyFiltered].slice(0, 5)),
    );
  } catch {}
}

/**
 * Server-safe parser for reading the homyz_recent_searches cookie inside Server Components.
 */
export function parseServerRecentSearches(cookieValue?: string | null): StoredSearchContext[] {
  if (!cookieValue) return [];
  try {
    let unescaped = cookieValue;
    try {
      unescaped = decodeURIComponent(cookieValue);
    } catch {}
    const parsed = JSON.parse(unescaped);
    if (!Array.isArray(parsed)) return [];
    const mapped: (StoredSearchContext | null)[] = parsed.map((item) => {
      const validated = validateSearchContext(item);
      if (!validated) return null;
      return {
        ...validated,
        savedAt: validated.searchedAt,
      };
    });
    return mapped.filter((item): item is StoredSearchContext => item !== null).slice(0, 4);
  } catch {
    return [];
  }
}

export function clearRecentlyViewedProperties(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_VIEWED_KEY);
  } catch {}
}

export function clearRecentSearchContexts(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    localStorage.removeItem(LEGACY_RECENT_KEY);
    deleteClientCookie(RECENT_SEARCHES_COOKIE);
  } catch {}
}
