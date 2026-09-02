import { deleteCache, deleteCacheByPattern, incrCounter } from "./cache";
import { CACHE_KEYS } from "./keys";

/**
 * Dependency-aware cache invalidation suite.
 * Specifications §7, §8, §9, §10.
 */

/** Invalidate user profile and administrative counters */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    deleteCache(CACHE_KEYS.USER_PROFILE(userId)),
    deleteCache(CACHE_KEYS.ADMIN_STATS()),
  ]);
}

/** Invalidate a listing and bump public catalogue search version */
export async function invalidateListingCache(listingId: string, hostId?: string): Promise<void> {
  const deletes: Promise<void>[] = [
    deleteCache(CACHE_KEYS.LISTING(listingId)),
    deleteCache(CACHE_KEYS.LISTING_DETAILS(listingId)),
    incrCounter(CACHE_KEYS.LISTINGS_PUBLIC_VER()),
  ];

  if (hostId) {
    deletes.push(deleteCache(CACHE_KEYS.HOST_LISTINGS(hostId)));
    deletes.push(deleteCache(CACHE_KEYS.USER_PROFILE(hostId)));
  }

  await Promise.all(deletes);
}

/** Invalidate booking details and user/host booking list patterns */
export async function invalidateBookingCache(
  bookingId: string,
  userId?: string,
  hostId?: string,
): Promise<void> {
  const deletes: Promise<void>[] = [
    deleteCache(CACHE_KEYS.BOOKING(bookingId)),
    deleteCache(CACHE_KEYS.GUEST_ANALYTICS()),
    deleteCache(CACHE_KEYS.ADMIN_STATS()),
  ];

  if (userId) {
    deletes.push(deleteCacheByPattern(`homyz:bookings:user:${userId}:*`));
  }
  if (hostId) {
    deletes.push(deleteCacheByPattern(`homyz:bookings:host:${hostId}:*`));
  }

  await Promise.all(deletes);
}

/** Invalidate administrative dashboard metrics */
export async function invalidateAdminDashboardCache(): Promise<void> {
  await Promise.all([
    deleteCache(CACHE_KEYS.ADMIN_STATS()),
    deleteCache(CACHE_KEYS.GUEST_ANALYTICS()),
    deleteCache(CACHE_KEYS.HOST_COMPLIANCE_METRICS()),
    deleteCache(CACHE_KEYS.HOST_OPS_METRICS("TODAY")),
    deleteCache(CACHE_KEYS.HOST_OPS_METRICS("7_DAYS")),
    deleteCache(CACHE_KEYS.HOST_OPS_METRICS("30_DAYS")),
    deleteCache(CACHE_KEYS.HOST_OPS_METRICS("90_DAYS")),
  ]);
}
