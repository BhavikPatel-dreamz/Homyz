import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { verifyUserBookings } from "./travel-destination.service";

export interface TravelerReconciliationSummary {
  userId: string;
  verifiedDestinationsCount: number;
  completedStaysCount: number;
  awardedStampsCount: number;
  evaluatedAt: string;
}

/**
 * Authoritative, idempotent reconciliation engine for a traveler's verified
 * destinations based on completed stays. Stamp collection is intentionally
 * explicit: an admin catalog entry is not a user-owned stamp.
 *
 * Safe to rerun repeatedly; will never duplicate records or regress earned status.
 */
export async function reconcileTravelerHistory(userId: string): Promise<TravelerReconciliationSummary> {
  if (!userId) throw AppError.badRequest("userId is required for reconciliation");

  // 1. Verify bookings and create/update UserDestination records
  const destResult = await verifyUserBookings(userId);

  return {
    userId,
    verifiedDestinationsCount: destResult.verifiedDestinationsCount,
    completedStaysCount: destResult.completedStaysCount,
    awardedStampsCount: 0,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Bounded batch reconciliation job for background processing / migration backfills.
 */
export async function reconcileBatchTravelers(limit = 50): Promise<{
  processedUsersCount: number;
  summaries: TravelerReconciliationSummary[];
}> {
  // Find users who have completed bookings
  const usersWithBookings = await prisma.user.findMany({
    where: {
      bookings: {
        some: {
          status: "CONFIRMED",
        },
      },
    },
    select: { id: true },
    take: limit,
  });

  const summaries: TravelerReconciliationSummary[] = [];

  for (const user of usersWithBookings) {
    try {
      const summary = await reconcileTravelerHistory(user.id);
      summaries.push(summary);
    } catch (err) {
      console.error(`[reconcileBatchTravelers] Failed to reconcile user ${user.id}:`, err);
    }
  }

  return {
    processedUsersCount: summaries.length,
    summaries,
  };
}
