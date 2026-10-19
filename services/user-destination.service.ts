import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { TravelEvidenceSource, TravelEvidenceStatus } from "@/generated/prisma/enums";
import { travelDestinationService } from "./travel-destination.service";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import type {
  AddSelfDeclaredDestinationInput,
  UserDestinationDto,
} from "@/lib/validation/travel-trip";

export class UserDestinationService {
  /**
   * Retrieves all visited destinations for the user with derived verification status and trip counts.
   */
  async getUserDestinations(userId: string): Promise<UserDestinationDto[]> {
    const records = await prisma.userDestination.findMany({
      where: { userId },
      include: {
        destination: true,
        evidence: {
          where: { status: TravelEvidenceStatus.ACTIVE },
        },
      },
      orderBy: [{ lastVisitedAt: "desc" }, { createdAt: "desc" }],
    });

    // Also get trip counts grouped by destinationId for this user
    const tripCounts = await prisma.travelTrip.groupBy({
      by: ["destinationId"],
      where: {
        userId,
        deletedAt: null,
        destinationId: { not: null },
      },
      _count: { _all: true },
    });

    const tripCountMap = new Map<string, number>();
    for (const tc of tripCounts) {
      if (tc.destinationId) {
        tripCountMap.set(tc.destinationId, tc._count._all);
      }
    }

    return records.map((r: (typeof records)[number]) => {
      const isVerified = r.evidence.some(
        (e: (typeof r.evidence)[number]) => e.source === TravelEvidenceSource.VERIFIED_BOOKING,
      );

      return {
        id: r.id,
        destinationId: r.destinationId,
        name: r.destination.name,
        countryCode: r.destination.countryCode,
        countryName: r.destination.countryName,
        regionName: r.destination.regionName,
        isVerified,
        source: isVerified ? "BOOKING_VERIFIED" : "SELF_DECLARED",
        selfDeclared: r.selfDeclared,
        firstVisitedAt: r.firstVisitedAt ? r.firstVisitedAt.toISOString() : null,
        lastVisitedAt: r.lastVisitedAt ? r.lastVisitedAt.toISOString() : null,
        activeEvidenceCount: r.evidence.length,
        tripsCount: tripCountMap.get(r.destinationId) || 0,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  /**
   * Adds or upgrades a self-declared destination manually selected by the user.
   */
  async addSelfDeclaredDestination(
    userId: string,
    input: AddSelfDeclaredDestinationInput,
  ): Promise<UserDestinationDto> {
    const destination = await travelDestinationService.findOrCreateDestination({
      name: input.name,
      countryCode: input.countryCode,
      countryName: input.countryName,
      regionName: input.regionName,
      regionCode: input.regionCode,
      latitude: input.latitude,
      longitude: input.longitude,
      providerPlaceId: input.providerPlaceId,
    });

    const firstVisitedAt = input.firstVisitedAt ? new Date(input.firstVisitedAt) : undefined;
    const lastVisitedAt = input.lastVisitedAt ? new Date(input.lastVisitedAt) : undefined;

    // Concurrency-safe upsert of UserDestination
    const userDestination = await prisma.userDestination.upsert({
      where: {
        userId_destinationId: {
          userId,
          destinationId: destination.id,
        },
      },
      create: {
        userId,
        destinationId: destination.id,
        selfDeclared: true,
        firstVisitedAt,
        lastVisitedAt,
      },
      update: {
        selfDeclared: true,
        ...(firstVisitedAt ? { firstVisitedAt } : {}),
        ...(lastVisitedAt ? { lastVisitedAt } : {}),
      },
      include: {
        destination: true,
        evidence: {
          where: { status: TravelEvidenceStatus.ACTIVE },
        },
      },
    });

    // Ensure manual declaration evidence exists
    const hasManualEvidence = userDestination.evidence.some(
      (e: (typeof userDestination.evidence)[number]) =>
        e.source === TravelEvidenceSource.MANUAL_DECLARATION,
    );

    if (!hasManualEvidence) {
      await prisma.travelVisitEvidence.create({
        data: {
          userDestinationId: userDestination.id,
          source: TravelEvidenceSource.MANUAL_DECLARATION,
          status: TravelEvidenceStatus.ACTIVE,
          relevantDate: lastVisitedAt ?? firstVisitedAt,
          notes: "Self-declared visited destination added by traveler",
        },
      });
    }

    await invalidateUserCache(userId);

    const isVerified = userDestination.evidence.some(
      (e: (typeof userDestination.evidence)[number]) =>
        e.source === TravelEvidenceSource.VERIFIED_BOOKING,
    );

    return {
      id: userDestination.id,
      destinationId: userDestination.destinationId,
      name: userDestination.destination.name,
      countryCode: userDestination.destination.countryCode,
      countryName: userDestination.destination.countryName,
      regionName: userDestination.destination.regionName,
      isVerified,
      source: isVerified ? "BOOKING_VERIFIED" : "SELF_DECLARED",
      selfDeclared: true,
      firstVisitedAt: userDestination.firstVisitedAt ? userDestination.firstVisitedAt.toISOString() : null,
      lastVisitedAt: userDestination.lastVisitedAt ? userDestination.lastVisitedAt.toISOString() : null,
      activeEvidenceCount: userDestination.evidence.length + (hasManualEvidence ? 0 : 1),
      tripsCount: 0,
      createdAt: userDestination.createdAt.toISOString(),
    };
  }

  /**
   * Removes a self-declared destination.
   * If the destination is backed by eligible completed Homyz bookings,
   * the verified booking evidence is PRESERVED, and only the self-declared flag is un-set.
   */
  async removeSelfDeclaredDestination(
    userId: string,
    userDestinationId: string,
  ): Promise<{ removed: boolean; preservedVerifiedBooking: boolean }> {
    const existing = await prisma.userDestination.findUnique({
      where: { id: userDestinationId },
      include: {
        evidence: {
          where: { status: TravelEvidenceStatus.ACTIVE },
        },
      },
    });

    if (!existing || existing.userId !== userId) {
      throw AppError.notFound("Visited destination not found.");
    }

    const hasBookingEvidence = existing.evidence.some(
      (e: (typeof existing.evidence)[number]) =>
        e.source === TravelEvidenceSource.VERIFIED_BOOKING,
    );

    if (hasBookingEvidence) {
      // Preserve the verified booking! Just remove selfDeclared declaration and manual evidence
      await prisma.$transaction([
        prisma.userDestination.update({
          where: { id: userDestinationId },
          data: { selfDeclared: false },
        }),
        prisma.travelVisitEvidence.deleteMany({
          where: {
            userDestinationId,
            source: TravelEvidenceSource.MANUAL_DECLARATION,
          },
        }),
      ]);

      await invalidateUserCache(userId);
      return { removed: false, preservedVerifiedBooking: true };
    } else {
      // Only self-declared: safe to delete UserDestination
      await prisma.userDestination.delete({
        where: { id: userDestinationId },
      });

      await invalidateUserCache(userId);
      return { removed: true, preservedVerifiedBooking: false };
    }
  }
}

export const userDestinationService = new UserDestinationService();

