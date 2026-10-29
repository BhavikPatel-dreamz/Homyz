import { deleteCache, deleteCacheByPattern, incrCounter } from "./cache";
import { CACHE_KEYS } from "./keys";

/**
 * Dependency-aware cache invalidation suite.
 * Specifications §7, §8, §9, §10.
 */

/** Invalidate user profile, stats, and administrative counters */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    deleteCache(CACHE_KEYS.USER_PROFILE(userId)),
    deleteCache(CACHE_KEYS.USER_STATS(userId)),
    deleteCache(CACHE_KEYS.PERSONAL_INFO(userId)),
  ]);
}

/** Invalidate a listing and bump public catalogue search version */
export async function invalidateListingCache(listingId: string, hostId?: string): Promise<void> {
  const deletes: Promise<void>[] = [
    deleteCache(CACHE_KEYS.LISTING(listingId)),
    deleteCache(CACHE_KEYS.LISTING_DETAILS(listingId)),
    incrCounter(CACHE_KEYS.LISTING_REVIEWS_VER(listingId)),
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
    incrCounter(CACHE_KEYS.LISTINGS_PUBLIC_VER()),
  ];

  if (userId) {
    deletes.push(deleteCacheByPattern(`homyz:bookings:user:${userId}:*`));
    // Invalidate guest stats and profile so trip counts stay accurate
    deletes.push(deleteCache(CACHE_KEYS.USER_STATS(userId)));
    deletes.push(deleteCache(CACHE_KEYS.USER_PROFILE(userId)));
    // Also explicitly delete common user booking cache keys for instant invalidation
    deletes.push(deleteCache(CACHE_KEYS.BOOKINGS_USER(userId, "all", 0, 50)));
    deletes.push(deleteCache(CACHE_KEYS.BOOKINGS_USER(userId, "upcoming", 0, 50)));
    deletes.push(deleteCache(CACHE_KEYS.BOOKINGS_USER(userId, "all", 0, 20)));
    deletes.push(deleteCache(CACHE_KEYS.BOOKINGS_USER(userId, "upcoming", 0, 20)));
    deletes.push(deleteCache(CACHE_KEYS.BOOKINGS_USER(userId, "all", 0, 100)));
    deletes.push(deleteCache(CACHE_KEYS.BOOKINGS_USER(userId, "upcoming", 0, 100)));
  }
  if (hostId) {
    deletes.push(deleteCacheByPattern(`homyz:bookings:host:${hostId}:*`));
    deletes.push(deleteCache(CACHE_KEYS.HOST_LISTINGS(hostId)));
  }

  await Promise.all(deletes);

  // Bust Next.js App Router RSC cache across guest, host, and admin pages
  try {
    const { revalidateBookingPaths } = await import("@/lib/booking/booking-cache-revalidate");
    revalidateBookingPaths(bookingId);
  } catch {
    // Expected when running outside Next.js request context (e.g. tests or background workers)
  }
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
