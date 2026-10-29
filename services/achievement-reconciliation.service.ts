import { AchievementEventType, BookingStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import { prisma } from "@/lib/db/prisma";
import {
  enqueueAchievementEventProcessing,
  recordTrustedAchievementEvent,
} from "@/services/achievement-event.service";

export interface AchievementEvidenceReconciliationOptions {
  /** Defaults to dry-run so a call cannot backfill by accident. */
  dryRun?: boolean;
  /** Explicitly requests candidate-event persistence; also requires server config. */
  persistEvidence?: boolean;
  limit?: number;
  cursor?: string;
  checkpointScope?: string;
  now?: Date;
}

export interface AchievementEvidenceReconciliationSummary {
  dryRun: boolean;
  persisted: boolean;
  scannedCount: number;
  candidateCount: number;
  duplicateCount: number;
  unsupportedCount: number;
  skippedIncompleteCount: number;
  nextCursor: string | null;
  checkpointScope: string | null;
  startedAt: string;
  completedAt: string;
}

function isEvidenceBackfillExplicitlyEnabled() {
  return process.env.STAYELITE_EVIDENCE_BACKFILL_ENABLED === "true";
}

/**
 * Bounded reconciliation for the event/evidence foundation. It is intentionally
 * separate from the existing travel-profile reconciler: it neither updates
 * UserDestination nor awards stamps, achievements, tiers, points, or rewards.
 */
export async function reconcileAchievementEvidence(
  options: AchievementEvidenceReconciliationOptions = {},
): Promise<AchievementEvidenceReconciliationSummary> {
  const startedAt = new Date();
  const now = options.now ?? startedAt;
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const dryRun = options.dryRun !== false;
  const persistEvidence = options.persistEvidence === true;
  const shouldPersist = !dryRun && persistEvidence;

  if (shouldPersist && !isEvidenceBackfillExplicitlyEnabled()) {
    throw AppError.forbidden(
      "Evidence-only backfill is disabled. Set STAYELITE_EVIDENCE_BACKFILL_ENABLED=true in the server environment.",
    );
  }
  if (!dryRun && !persistEvidence) {
    throw AppError.validation("Non-dry reconciliation must explicitly request persistEvidence.");
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      ...(options.cursor ? { id: { gt: options.cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
    include: {
      listing: { select: { checkOutTime: true, country: true } },
      visitEvidence: { select: { id: true } },
    },
  });

  let candidateCount = 0;
  let duplicateCount = 0;
  let unsupportedCount = 0;
  let skippedIncompleteCount = 0;

  for (const booking of bookings) {
    if (!isCompletedConfirmedBooking({
      dbStatus: booking.status,
      startDate: booking.startDate,
      endDate: booking.endDate,
      checkOutTime: booking.listing.checkOutTime,
      now,
    })) {
      skippedIncompleteCount += 1;
      continue;
    }

    if (!booking.listing.country?.trim()) unsupportedCount += 1;
    if (booking.visitEvidence) {
      duplicateCount += 1;
      continue;
    }
    candidateCount += 1;

    if (shouldPersist) {
      const event = await recordTrustedAchievementEvent({
        type: AchievementEventType.STAY_COMPLETION_CANDIDATE,
        sourceEntityType: "BOOKING",
        sourceEntityId: booking.id,
        bookingId: booking.id,
        userId: booking.userId,
        occurredAt: booking.endDate,
        sourceVersion: booking.updatedAt.toISOString(),
        idempotencyKey: `achievement:stay-candidate:${booking.id}`,
        metadata: {
          capture: "bounded-reconciliation",
          completionPolicy: "CANDIDATE_ONLY_PHASE_2",
          listingCountryPresent: Boolean(booking.listing.country?.trim()),
        },
      });
      // The durable outbox has already committed. A queue outage therefore
      // leaves a recoverable PENDING event rather than losing candidate data.
      try {
        await enqueueAchievementEventProcessing(event.id);
      } catch (error) {
        console.warn(`[achievement-reconciliation] queued recovery required for ${event.id}:`, error);
      }
    }
  }

  const completedAt = new Date();
  const summary: AchievementEvidenceReconciliationSummary = {
    dryRun,
    persisted: shouldPersist,
    scannedCount: bookings.length,
    candidateCount,
    duplicateCount,
    unsupportedCount,
    skippedIncompleteCount,
    nextCursor: bookings.length === limit ? bookings.at(-1)?.id ?? null : null,
    checkpointScope: shouldPersist ? (options.checkpointScope ?? "stayelite-phase-2-evidence") : null,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };

  if (shouldPersist && summary.checkpointScope) {
    await prisma.achievementReconciliationCheckpoint.upsert({
      where: { scope: summary.checkpointScope },
      create: {
        scope: summary.checkpointScope,
        cursor: summary.nextCursor,
        scannedCount: summary.scannedCount,
        candidateCount: summary.candidateCount,
        unsupportedCount: summary.unsupportedCount,
        duplicateCount: summary.duplicateCount,
        lastRunAt: completedAt,
        summary: JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue,
      },
      update: {
        cursor: summary.nextCursor,
        scannedCount: { increment: summary.scannedCount },
        candidateCount: { increment: summary.candidateCount },
        unsupportedCount: { increment: summary.unsupportedCount },
        duplicateCount: { increment: summary.duplicateCount },
        lastRunAt: completedAt,
        summary: JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue,
      },
    });
  }

  return summary;
}

/**
 * Read-only Phase 3/4 reconciliation entry point. It deliberately performs no
 * backfill and no award issuance; callers can page this report safely before
 * any future, separately approved rollout.
 */
export async function reconcileStayEliteAchievementIntelligence(options: {
  userId?: string;
  cursor?: string;
  limit?: number;
} = {}) {
  const [{ reconcileDestinationAchievementIntelligence }, { reconcileQualityBehaviorAchievements }, { reconcileStayEliteTiers }] = await Promise.all([
    import("@/services/stayelite-destination-intelligence.service"),
    import("@/services/stayelite-quality-behavior.service"),
    import("@/services/stayelite-tier.service"),
  ]);
  const [destination, qualityBehavior, tiers] = await Promise.all([
    reconcileDestinationAchievementIntelligence(options),
    reconcileQualityBehaviorAchievements(options),
    reconcileStayEliteTiers(options),
  ]);
  return {
    dryRun: true,
    destination,
    qualityBehavior,
    tiers,
    awardIssued: false,
    pointsIssued: false,
    tierChanged: false,
  };
}
