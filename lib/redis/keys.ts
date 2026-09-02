import crypto from "crypto";

// Centralized cache-key definitions and hash utility.
// Specification §5, §11, §12: Namespace-based, deterministic, collision-safe keys.

const NS = "homyz";

/** Deterministically hash filter objects for pagination & search query caching */
export function hashFilters(filters: Record<string, unknown>): string {
  const sortedKeys = Object.keys(filters).sort();
  const normalized: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    const val = filters[k];
    if (val !== undefined && val !== null && val !== "") {
      normalized[k] = val;
    }
  }
  return crypto.createHash("md5").update(JSON.stringify(normalized)).digest("hex").slice(0, 12);
}

export const CACHE_KEYS = {
  /** User profile data by user ID */
  USER_PROFILE: (userId: string) => `${NS}:user:${userId}:profile`,

  /** Listing details by listing ID */
  LISTING: (listingId: string) => `${NS}:listing:${listingId}`,
  LISTING_DETAILS: (listingId: string) => `${NS}:listing:${listingId}:details`,
  HOST_LISTINGS: (hostId: string) => `${NS}:host:${hostId}:listings`,

  /** Version-tagged public listings search */
  LISTINGS_PUBLIC_VER: () => `${NS}:listings:published:ver`,
  LISTINGS_SEARCH: (ver: number, filterHash: string, skip: number, take: number) =>
    `${NS}:listings:search:v${ver}:${filterHash}:s${skip}:t${take}`,

  /** Bookings */
  BOOKING: (bookingId: string) => `${NS}:booking:${bookingId}`,
  BOOKINGS_USER: (userId: string, page: number = 1) => `${NS}:bookings:user:${userId}:p${page}`,
  BOOKINGS_HOST: (hostId: string, page: number = 1) => `${NS}:bookings:host:${hostId}:p${page}`,

  /** Admin & Host Dashboards */
  ADMIN_STATS: () => `${NS}:admin:stats:global`,
  ADMIN_UNIFIED_HOSTS: (filterHash: string) => `${NS}:admin:hosts:${filterHash}`,
  GUEST_ANALYTICS: () => `${NS}:admin:guest:analytics`,
  HOST_OPS_METRICS: (preset: string) => `${NS}:host:ops:${preset}`,
  HOST_COMPLIANCE_METRICS: () => `${NS}:host:compliance:metrics`,
} as const;

// Backward-compatible alias for existing service files using keys.
export const keys = {
  listing: CACHE_KEYS.LISTING,
  listingsPublicVersion: CACHE_KEYS.LISTINGS_PUBLIC_VER,
  listingsPublic: (ver: number, skip: number, take: number) =>
    CACHE_KEYS.LISTINGS_SEARCH(ver, "default", skip, take),
  userProfile: CACHE_KEYS.USER_PROFILE,
  statsGlobal: CACHE_KEYS.ADMIN_STATS,
  hostOperationsMetrics: CACHE_KEYS.HOST_OPS_METRICS,
  hostComplianceMetrics: CACHE_KEYS.HOST_COMPLIANCE_METRICS,
  guestAnalytics: CACHE_KEYS.GUEST_ANALYTICS,
} as const;
