import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Country } from "country-state-city";
import { BookingStatus, TravelEvidenceSource, TravelEvidenceStatus } from "@/generated/prisma/enums";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import { travelDestinationService } from "./travel-destination.service";
import { invalidateUserCache } from "@/lib/redis/invalidation";

export interface BookingEligibilityDetails {
  eligible: boolean;
  reason?: string;
  destinationCity?: string;
  destinationCountry?: string;
}

function resolveCountryCode(country: string): string {
  const normalized = country.trim();
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  return (
    Country.getAllCountries().find(
      (item) => item.name.localeCompare(normalized, undefined, { sensitivity: "accent" }) === 0,
    )?.isoCode || "ZZ"
  );
}

export class TravelBookingSyncService {
  /**
   * Evaluates if a booking record qualifies as verified travel evidence.
   * Conforms strictly to Booking Domain specifications:
   * 1. Status is CONFIRMED.
   * 2. Checkout is in the past.
   * 3. Listing location data is present.
   */
  isEligibleBookingForTravelEvidence(booking: {
    status: BookingStatus | string;
    startDate: Date | string;
    endDate: Date | string;
    listing?: {
      city?: string | null;
      country?: string | null;
      locationSearch?: string | null;
      checkOutTime?: string | null;
    } | null;
  }): BookingEligibilityDetails {
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== "CONFIRMED") {
      return { eligible: false, reason: `Booking status is ${booking.status}, not CONFIRMED.` };
    }

    const isCompleted = isCompletedConfirmedBooking({
      dbStatus: booking.status,
      startDate: booking.startDate,
      endDate: booking.endDate,
      checkOutTime: booking.listing?.checkOutTime,
    });

    if (!isCompleted) {
      return { eligible: false, reason: "Stay has not yet completed (checkout time is in the future)." };
    }

    const city = (booking.listing?.city || booking.listing?.locationSearch || "").trim();
    const country = (booking.listing?.country || "SA").trim();

    if (!city) {
      return { eligible: false, reason: "Listing lacks verified city location data." };
    }

    return {
      eligible: true,
      destinationCity: city,
      destinationCountry: country,
    };
  }

  /**
   * Synchronizes verified travel evidence for an individual booking.
   * Handles qualifications, date changes, and revocation upon cancellation.
   */
  async syncBookingTravelEvidence(bookingId: string): Promise<{
    synced: boolean;
    status: "ACTIVE" | "REVOKED" | "SKIPPED";
    reason?: string;
  }> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          select: {
            city: true,
            country: true,
            locationSearch: true,
            checkOutTime: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!booking) {
      return { synced: false, status: "SKIPPED", reason: "Booking not found." };
    }

    const eligibility = this.isEligibleBookingForTravelEvidence(booking);

    if (eligibility.eligible && eligibility.destinationCity && eligibility.destinationCountry) {
      // 1. Resolve canonical destination
      const destination = await travelDestinationService.findOrCreateDestination({
        name: eligibility.destinationCity,
        countryCode: resolveCountryCode(eligibility.destinationCountry),
        countryName: eligibility.destinationCountry,
        latitude: booking.listing?.latitude,
        longitude: booking.listing?.longitude,
      });

      // 2. Find or create UserDestination record
      let userDestination = await prisma.userDestination.findUnique({
        where: {
          userId_destinationId: {
            userId: booking.userId,
            destinationId: destination.id,
          },
        },
      });

      const bookingStart = new Date(booking.startDate);
      const bookingEnd = new Date(booking.endDate);

      if (!userDestination) {
        userDestination = await prisma.userDestination.create({
          data: {
            userId: booking.userId,
            destinationId: destination.id,
            selfDeclared: false,
            firstVisitedAt: bookingStart,
            lastVisitedAt: bookingEnd,
          },
        });
      } else {
        // Expand visit date window
        const updatedFirst =
          !userDestination.firstVisitedAt || bookingStart < userDestination.firstVisitedAt
            ? bookingStart
            : userDestination.firstVisitedAt;
        const updatedLast =
          !userDestination.lastVisitedAt || bookingEnd > userDestination.lastVisitedAt
            ? bookingEnd
            : userDestination.lastVisitedAt;

        userDestination = await prisma.userDestination.update({
          where: { id: userDestination.id },
          data: {
            firstVisitedAt: updatedFirst,
            lastVisitedAt: updatedLast,
          },
        });
      }

      // 3. Upsert TravelVisitEvidence for this booking
      await prisma.travelVisitEvidence.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          userDestinationId: userDestination.id,
          source: TravelEvidenceSource.VERIFIED_BOOKING,
          status: TravelEvidenceStatus.ACTIVE,
          relevantDate: bookingEnd,
          notes: `Verified stay at listing ${booking.listingId}`,
        },
        update: {
          userDestinationId: userDestination.id,
          status: TravelEvidenceStatus.ACTIVE,
          relevantDate: bookingEnd,
        },
      });

      await invalidateUserCache(booking.userId);
      return { synced: true, status: "ACTIVE" };
    } else {
      // Ineligible booking: Check if active evidence previously existed and must be revoked
      const existingEvidence = await prisma.travelVisitEvidence.findUnique({
        where: { bookingId: booking.id },
        include: { userDestination: true },
      });

      if (existingEvidence && existingEvidence.status === TravelEvidenceStatus.ACTIVE) {
        await prisma.travelVisitEvidence.update({
          where: { id: existingEvidence.id },
          data: {
            status: TravelEvidenceStatus.REVOKED,
            notes: `Revoked: ${eligibility.reason || "Booking ineligible"}`,
          },
        });

        // Check remaining active evidence for userDestination
        const activeCount = await prisma.travelVisitEvidence.count({
          where: {
            userDestinationId: existingEvidence.userDestinationId,
            status: TravelEvidenceStatus.ACTIVE,
          },
        });

        // If no active evidence left and destination was NOT self-declared by user, safely remove userDestination
        if (activeCount === 0 && !existingEvidence.userDestination.selfDeclared) {
          await prisma.userDestination.delete({
            where: { id: existingEvidence.userDestinationId },
          });
        }

        await invalidateUserCache(booking.userId);
        return { synced: true, status: "REVOKED", reason: eligibility.reason };
      }

      return { synced: false, status: "SKIPPED", reason: eligibility.reason };
    }
  }

  /**
   * Reconciles all bookings for a user.
   */
  async syncUserAllBookings(userId: string): Promise<{ total: number; active: number; revoked: number }> {
    const bookings = await prisma.booking.findMany({
      where: { userId },
      select: { id: true },
    });

    let active = 0;
    let revoked = 0;

    for (const b of bookings) {
      const res = await this.syncBookingTravelEvidence(b.id);
      if (res.status === "ACTIVE") active++;
      if (res.status === "REVOKED") revoked++;
    }

    return { total: bookings.length, active, revoked };
  }

  /**
   * Controlled, idempotent backfill for completed confirmed bookings.
   */
  async backfillVerifiedBookings(opts: {
    batchSize?: number;
    dryRun?: boolean;
    userId?: string;
  } = {}): Promise<{
    processed: number;
    eligibleCount: number;
    ineligibleCount: number;
    dryRun: boolean;
  }> {
    const batchSize = opts.batchSize ?? 100;
    const where: Prisma.BookingWhereInput = {
      status: BookingStatus.CONFIRMED,
      endDate: { lte: new Date() },
    };
    if (opts.userId) where.userId = opts.userId;

    const candidates = await prisma.booking.findMany({
      where,
      take: batchSize,
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    let eligibleCount = 0;
    let ineligibleCount = 0;

    for (const item of candidates) {
      if (opts.dryRun) {
        eligibleCount++;
      } else {
        const res = await this.syncBookingTravelEvidence(item.id);
        if (res.synced && res.status === "ACTIVE") eligibleCount++;
        else ineligibleCount++;
      }
    }

    return {
      processed: candidates.length,
      eligibleCount,
      ineligibleCount,
      dryRun: Boolean(opts.dryRun),
    };
  }
}

export const travelBookingSyncService = new TravelBookingSyncService();
