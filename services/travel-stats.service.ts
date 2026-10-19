import { prisma } from "@/lib/db/prisma";
import { BookingStatus, TravelEvidenceSource, TravelEvidenceStatus } from "@/generated/prisma/enums";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import { getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import type { TravelStatsDto } from "@/lib/validation/travel-trip";

const TRAVEL_STATS_TTL_SECONDS = 180; // 3 minutes

export class TravelStatsService {
  /**
   * Computes authoritative travel statistics for an authenticated owner.
   * Cached with short TTL and invalidated on trip/destination/photo/booking mutations.
   */
  async getTravelStats(userId: string): Promise<TravelStatsDto> {
    return getOrSetCache(
      CACHE_KEYS.USER_TRAVEL_STATS(userId),
      async () => this.computeTravelStats(userId),
      { ttl: TRAVEL_STATS_TTL_SECONDS },
    );
  }

  /**
   * Uncached pure calculation of real travel metrics.
   */
  async computeTravelStats(userId: string): Promise<TravelStatsDto> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const [
      // 1. Verified trips: Completed confirmed bookings
      completedBeforeToday,
      bookingsEndingToday,
      // 2. Travel albums: Active non-deleted trips
      travelAlbumsCount,
      // 3. User destinations with their destination country & evidence
      userDestinations,
      // 4. Album photos: Active photos attached to user's trips
      albumPhotosCount,
    ] = await Promise.all([
      prisma.booking.count({
        where: {
          userId,
          status: BookingStatus.CONFIRMED,
          endDate: { lt: startOfToday },
        },
      }),
      prisma.booking.findMany({
        where: {
          userId,
          status: BookingStatus.CONFIRMED,
          endDate: { gte: startOfToday, lte: now },
        },
        select: {
          startDate: true,
          endDate: true,
          listing: {
            select: { checkInStart: true, checkOutTime: true },
          },
        },
      }),
      prisma.travelTrip.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
      prisma.userDestination.findMany({
        where: { userId },
        include: {
          destination: {
            select: { id: true, countryCode: true },
          },
          evidence: {
            where: { status: TravelEvidenceStatus.ACTIVE },
            select: { source: true },
          },
        },
      }),
      prisma.travelPhoto.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ]);

    const completedToday = bookingsEndingToday.filter((booking: (typeof bookingsEndingToday)[number]) =>
      isCompletedConfirmedBooking({
        dbStatus: BookingStatus.CONFIRMED,
        startDate: booking.startDate,
        endDate: booking.endDate,
        checkOutTime: booking.listing?.checkOutTime,
        now,
      }),
    ).length;

    const verifiedTrips = completedBeforeToday + completedToday;

    // Distinct visited cities and countries
    const visitedCityIds = new Set<string>();
    const visitedCountryCodes = new Set<string>();
    const verifiedCityIds = new Set<string>();
    const verifiedCountryCodes = new Set<string>();

    for (const ud of userDestinations) {
      visitedCityIds.add(ud.destination.id);
      if (ud.destination.countryCode) {
        visitedCountryCodes.add(ud.destination.countryCode.toUpperCase());
      }

      const hasVerifiedEvidence = ud.evidence.some(
        (e: (typeof ud.evidence)[number]) => e.source === TravelEvidenceSource.VERIFIED_BOOKING,
      );

      if (hasVerifiedEvidence) {
        verifiedCityIds.add(ud.destination.id);
        if (ud.destination.countryCode) {
          verifiedCountryCodes.add(ud.destination.countryCode.toUpperCase());
        }
      }
    }

    return {
      verifiedTrips,
      travelAlbums: travelAlbumsCount,
      verifiedCities: verifiedCityIds.size,
      verifiedCountries: verifiedCountryCodes.size,
      visitedCities: visitedCityIds.size,
      visitedCountries: visitedCountryCodes.size,
      albumPhotos: albumPhotosCount,
    };
  }
}

export const travelStatsService = new TravelStatsService();

