import "server-only";

import { BookingStatus, ReviewDirection, ReviewStatus, UserStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { differenceInBookingNights } from "@/lib/booking/booking-date";
import { computeBookingStatus } from "@/lib/booking/booking-status";
import { incrCounter } from "@/lib/redis/cache";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import { keys } from "@/lib/redis/keys";
import { resolveSuperhostLifecycleTransition } from "@/lib/superhost/lifecycle";
import {
  evaluateSuperhostRequirements,
  getLiveSuperhostWindow,
  getNextQuarterlyEvaluationDate,
  getQuarterlyCheckpointForDate,
  getQuarterlySuperhostWindow,
  isExcludedHostCancellation,
  isNonExcludedHostCancellation,
  isQuarterlyAssessmentWindow,
  isQuarterlyEvaluationCheckpoint,
  startOfUtcDay,
  type SuperhostQualificationResult,
} from "@/lib/superhost/rules";
import { messagingService } from "@/services/messaging.service";
import { notificationService } from "@/services/notification.service";

export {
  SUPERHOST_ASSESSMENT_WINDOW_DAYS,
  SUPERHOST_REVIEW_WINDOW_DAYS,
  evaluateSuperhostRequirements,
  getLiveSuperhostWindow,
  getNextQuarterlyEvaluationDate,
  getQuarterlyCheckpointForDate,
  getQuarterlySuperhostWindow,
  getSuperhostEvaluationWindow,
  getSuperhostReviewWindowExpiryCutoff,
  isExcludedHostCancellation,
  isNonExcludedHostCancellation,
  isQuarterlyAssessmentWindow,
  isQuarterlyEvaluationCheckpoint,
  startOfUtcDay,
} from "@/lib/superhost/rules";

export interface SuperhostProgress {
  windowStart: Date;
  windowEnd: Date;
  isListingOwner: boolean;
  isListingOwnerMet: boolean;
  completedReservationsCount: number;
  completedNightsCount: number;
  hostingVolume: {
    reservationPathMet: boolean;
    longStayPathMet: boolean;
    met: boolean;
  };
  overallRating: number | null;
  publishedReviewCount: number;
  ratingMet: boolean;
  responseRatePercentage: number | null;
  totalGuestInquiries: number;
  respondedWithin24hCount: number;
  averageResponseTimeMinutes: number | null;
  responseRateMet: boolean;
  hostCancellationRatePercentage: number;
  hostCancellationCount: number;
  cancellationDenominator: number;
  cancellationMet: boolean;
  accountGoodStanding: boolean;
  accountStandingMet: boolean;
  /** A complete, explainable eligibility decision for this assessment window. */
  qualification: SuperhostQualificationResult;
  eligibleNow: boolean;
  failureReasons: string[];
}

export interface SuperhostStatus extends SuperhostProgress {
  officialStatus: boolean;
  qualifiedAt: Date | null;
  lastEvaluatedAt: Date | null;
  nextEvaluationAt: Date;
}

async function calculateSuperhostProgress(
  hostId: string,
  window: { windowStart: Date; windowEnd: Date },
  asOf: Date,
): Promise<SuperhostProgress> {
  const host = await prisma.user.findUnique({
    where: { id: hostId },
    select: { id: true, status: true },
  });
  if (!host) throw new Error("Host not found");

  // Listing.hostId deliberately excludes accepted co-host assignments: Superhost
  // is an owner-level program, not a permission-derived listing badge.
  const listings = await prisma.listing.findMany({
    where: { hostId, deletedAt: null },
    select: { id: true, hostingType: true, checkInStart: true, checkOutTime: true },
  }) as Array<{ id: string; hostingType?: string | null; checkInStart: string | null; checkOutTime: string | null }>;
  // Superhost only evaluates owners of stay (HOME) listings; experience and
  // service hosts without home listings are excluded from Superhost evaluation.
  const eligibleHomeListings = listings.filter((l) => !l.hostingType || l.hostingType === "HOME");
  const listingIds = eligibleHomeListings.map((listing) => listing.id);
  const listingSchedule = new Map<string, { id: string; checkInStart: string | null; checkOutTime: string | null }>(
    eligibleHomeListings.map((listing) => [listing.id, listing]),
  );

  if (listingIds.length === 0) {
    return emptyProgress(window, host.status, false);
  }

  const reviewWindowEndExclusive = new Date(window.windowEnd);
  reviewWindowEndExclusive.setUTCDate(reviewWindowEndExclusive.getUTCDate() + 1);
  const [bookings, reviewSummary, messagingMetrics] = await Promise.all([
    prisma.booking.findMany({
      where: {
        listingId: { in: listingIds },
        OR: [
          // Completed stays belong to the period in which the stay ended.
          {
            status: BookingStatus.CONFIRMED,
            endDate: { gte: window.windowStart, lte: window.windowEnd },
          },
          // A cancellation affects the period in which it occurred, rather
          // than the (possibly future) scheduled checkout date. Cancellation
          // writes update this record atomically with its cancellation event.
          {
            status: BookingStatus.CANCELLED,
            updatedAt: { gte: window.windowStart, lt: reviewWindowEndExclusive },
          },
        ],
      },
      select: { id: true, listingId: true, status: true, startDate: true, endDate: true, priceBreakdown: true },
    }),
    prisma.review.aggregate({
      where: {
        listingId: { in: listingIds },
        status: ReviewStatus.PUBLISHED,
        direction: ReviewDirection.GUEST_TO_PROPERTY,
        createdAt: { gte: window.windowStart, lt: reviewWindowEndExclusive },
        // ReviewService is the sole authority for final review publication. It
        // marks a review PUBLISHED when both parties have submitted, or when
        // the stored 14-day review deadline has elapsed. Requiring checkout
        // age here would incorrectly omit a reciprocally published review
        // before day 14 and would duplicate the review publication policy.
        booking: {
          is: {
            status: BookingStatus.CONFIRMED,
            endDate: { gte: window.windowStart, lte: window.windowEnd },
          },
        },
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    messagingService.calculateHostResponseMetrics(hostId, {
      windowStart: window.windowStart,
      windowEndExclusive: reviewWindowEndExclusive,
    }),
  ]);

  let completedReservationsCount = 0;
  let completedNightsCount = 0;
  let hostCancellationCount = 0;
  let unverifiedExcludedHostCancellationCount = 0;
  for (const booking of bookings) {
    if (booking.status === BookingStatus.CANCELLED) {
      if (isNonExcludedHostCancellation(booking.priceBreakdown)) hostCancellationCount++;
      if (isExcludedHostCancellation(booking.priceBreakdown)) unverifiedExcludedHostCancellationCount++;
      continue;
    }
    const listing = listingSchedule.get(booking.listingId);
    if (!listing) continue;
    const status = computeBookingStatus({
      dbStatus: booking.status,
      startDate: booking.startDate,
      endDate: booking.endDate,
      checkInStart: listing.checkInStart,
      checkOutTime: listing.checkOutTime,
      now: asOf,
    });
    if (status.status !== "COMPLETED") continue;
    completedReservationsCount++;
    completedNightsCount += differenceInBookingNights(booking.startDate, booking.endDate);
  }

  const overallRating = reviewSummary._avg.rating === null
    ? null
    : Math.round(reviewSummary._avg.rating * 100) / 100;
  const publishedReviewCount = reviewSummary._count._all;
  // The denominator is the same 12-month eligible population used for the
  // program: completed stays plus non-excluded host cancellations. Guest
  // cancellations do not penalize the host.
  const cancellationDenominator = completedReservationsCount + hostCancellationCount;
  const requirements = evaluateSuperhostRequirements({
    completedReservationsCount,
    completedNightsCount,
    overallRating,
    responseRatePercentage: messagingMetrics.responseRatePercentage,
    hostCancellationCount,
    cancellationDenominator,
    accountGoodStanding: host.status === UserStatus.ACTIVE,
    accountStatus: host.status,
    cancellationExceptionVerificationState: unverifiedExcludedHostCancellationCount > 0 ? "UNVERIFIED" : "VERIFIED",
    assessmentPeriod: window,
    isListingOwner: true,
  });

  return {
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    isListingOwner: requirements.isListingOwner,
    isListingOwnerMet: requirements.isListingOwnerMet,
    completedReservationsCount,
    completedNightsCount,
    hostingVolume: {
      reservationPathMet: requirements.reservationPathMet,
      longStayPathMet: requirements.longStayPathMet,
      met: requirements.hostingVolumeMet,
    },
    overallRating,
    publishedReviewCount,
    ratingMet: requirements.ratingMet,
    responseRatePercentage: messagingMetrics.responseRatePercentage,
    totalGuestInquiries: messagingMetrics.totalGuestInquiries,
    respondedWithin24hCount: messagingMetrics.respondedWithin24hCount,
    averageResponseTimeMinutes: messagingMetrics.averageResponseTimeMinutes,
    responseRateMet: requirements.responseRateMet,
    hostCancellationRatePercentage: requirements.hostCancellationRatePercentage,
    hostCancellationCount,
    cancellationDenominator,
    cancellationMet: requirements.cancellationMet,
    accountGoodStanding: requirements.accountGoodStanding,
    accountStandingMet: requirements.accountStandingMet,
    qualification: requirements.qualification,
    eligibleNow: requirements.eligibleNow,
    failureReasons: requirements.failureReasons,
  };
}

function emptyProgress(
  window: { windowStart: Date; windowEnd: Date },
  accountStatus: UserStatus,
  isListingOwner = false,
): SuperhostProgress {
  const requirements = evaluateSuperhostRequirements({
    completedReservationsCount: 0,
    completedNightsCount: 0,
    overallRating: null,
    responseRatePercentage: null,
    hostCancellationCount: 0,
    cancellationDenominator: 0,
    accountGoodStanding: accountStatus === UserStatus.ACTIVE,
    accountStatus,
    assessmentPeriod: window,
    isListingOwner,
  });
  return {
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    isListingOwner,
    isListingOwnerMet: requirements.isListingOwnerMet,
    completedReservationsCount: 0,
    completedNightsCount: 0,
    hostingVolume: {
      reservationPathMet: requirements.reservationPathMet,
      longStayPathMet: requirements.longStayPathMet,
      met: requirements.hostingVolumeMet,
    },
    overallRating: null,
    publishedReviewCount: 0,
    ratingMet: requirements.ratingMet,
    responseRatePercentage: null,
    totalGuestInquiries: 0,
    respondedWithin24hCount: 0,
    averageResponseTimeMinutes: null,
    responseRateMet: requirements.responseRateMet,
    hostCancellationRatePercentage: requirements.hostCancellationRatePercentage,
    hostCancellationCount: 0,
    cancellationDenominator: 0,
    cancellationMet: requirements.cancellationMet,
    accountGoodStanding: requirements.accountGoodStanding,
    accountStandingMet: requirements.accountStandingMet,
    qualification: requirements.qualification,
    eligibleNow: requirements.eligibleNow,
    failureReasons: requirements.failureReasons,
  };
}

export async function getLiveSuperhostStatus(hostId: string, asOf = new Date()): Promise<SuperhostStatus> {
  const [progress, official] = await Promise.all([
    calculateSuperhostProgress(hostId, getLiveSuperhostWindow(asOf), asOf),
    prisma.user.findUnique({
      where: { id: hostId },
      select: {
        isSuperhost: true,
        superhostQualifiedAt: true,
        superhostLastEvaluatedAt: true,
        superhostNextEvaluationAt: true,
      },
    }),
  ]);
  if (!official) throw new Error("Host not found");
  return {
    ...progress,
    officialStatus: official.isSuperhost,
    qualifiedAt: official.superhostQualifiedAt,
    lastEvaluatedAt: official.superhostLastEvaluatedAt,
    nextEvaluationAt: official.superhostNextEvaluationAt ?? getNextQuarterlyEvaluationDate(asOf),
  };
}

export async function evaluateHostAtQuarterlyCheckpoint(hostId: string, evaluationDate = new Date()) {
  const date = startOfUtcDay(evaluationDate);
  const checkpoint = isQuarterlyEvaluationCheckpoint(date)
    ? date
    : isQuarterlyAssessmentWindow(date)
    ? getQuarterlyCheckpointForDate(date)
    : date;
  const progress = await calculateSuperhostProgress(
    hostId,
    getQuarterlySuperhostWindow(checkpoint),
    checkpoint,
  );
  const previous = await prisma.user.findUnique({
    where: { id: hostId },
    select: { isSuperhost: true, superhostQualifiedAt: true },
  });
  if (!previous) throw new Error("Host not found");

  const transition = resolveSuperhostLifecycleTransition({
    previousOfficialStatus: previous.isSuperhost,
    previousQualifiedAt: previous.superhostQualifiedAt,
    eligibilityStatus: progress.qualification.eligibilityStatus,
    eligibleNow: progress.eligibleNow,
    checkpoint,
  });

  let result: { history: Awaited<ReturnType<typeof prisma.superhostEvaluation.findUnique>>; finalized: boolean };
  try {
    result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Quarterly assessments are immutable. The unique key is the final
      // concurrency guard; the preliminary read makes normal retries cheap,
      // while the P2002 fallback below handles simultaneous runners.
      const existing = await tx.superhostEvaluation.findUnique({
        where: { hostId_evaluationDate: { hostId, evaluationDate: checkpoint } },
      });
      if (existing) return { history: existing, finalized: false };

      const history = await tx.superhostEvaluation.create({
        data: {
          hostId,
          evaluationDate: checkpoint,
          windowStart: progress.windowStart,
          windowEnd: progress.windowEnd,
          completedReservations: progress.completedReservationsCount,
          completedNights: progress.completedNightsCount,
          overallRating: progress.overallRating,
          publishedReviewCount: progress.publishedReviewCount,
          responseRatePercentage: progress.responseRatePercentage,
          totalGuestInquiries: progress.totalGuestInquiries,
          hostCancellationRatePercentage: progress.hostCancellationRatePercentage,
          hostCancellationCount: progress.hostCancellationCount,
          cancellationDenominator: progress.cancellationDenominator,
          accountGoodStanding: progress.accountGoodStanding,
          // Blocked assessments are recorded as non-qualifying for review, but
          // transition does not revoke an already-earned official badge.
          qualified: progress.eligibleNow,
          failureReasons: progress.failureReasons,
        },
      });
      await tx.user.update({
        where: { id: hostId },
        data: {
          isSuperhost: transition.officialStatus,
          superhostQualifiedAt: transition.qualifiedAt,
          superhostLastEvaluatedAt: checkpoint,
          superhostNextEvaluationAt: getNextQuarterlyEvaluationDate(checkpoint),
        },
      });
      return { history, finalized: true };
    });
  } catch (error) {
    // A second worker can cross the preliminary read and race on the unique
    // history key. Treat that as an idempotent success after the winning
    // transaction commits; do not create a duplicate badge update or history.
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code !== "P2002") throw error;
    const existing = await prisma.superhostEvaluation.findUnique({
      where: { hostId_evaluationDate: { hostId, evaluationDate: checkpoint } },
    });
    if (!existing) throw error;
    result = { history: existing, finalized: false };
  }

  if (!result.history) throw new Error("Superhost evaluation history could not be loaded");

  const statusChanged = result.finalized && transition.appliesOfficialStatus && previous.isSuperhost !== transition.officialStatus;
  const renewed = result.finalized && transition.appliesOfficialStatus && previous.isSuperhost && transition.officialStatus;
  if (statusChanged) {
    // Public listing and discovery cards read the persisted badge, so invalidate
    // their versioned cache only when an official quarterly status changes.
    // These post-commit side effects must not make an already-persisted
    // assessment look failed or cause an unsafe lifecycle retry.
    const cacheEffects = await Promise.allSettled([
      incrCounter(keys.listingsPublicVersion()),
      invalidateUserCache(hostId),
    ]);
    for (const effect of cacheEffects) {
      if (effect.status === "rejected") {
        console.warn("[superhost.service] Post-evaluation cache invalidation failed", effect.reason);
      }
    }
  }
  // A finalized assessment has a unique history record, so these lifecycle
  // notifications cannot be duplicated by scheduler/admin retries. Blocked
  // assessments intentionally do not announce a qualification outcome.
  if (statusChanged || renewed) {
    await notificationService.create({
      userId: hostId,
      type: "SYSTEM",
      title: renewed ? "Your Superhost status was renewed" : transition.officialStatus ? "You are now a Superhost" : "Your Superhost status changed",
      message: renewed
        ? "Your official Superhost status was renewed for this evaluation period."
        : transition.officialStatus
        ? "Your official Superhost status is active for this evaluation period."
        : "Your official Superhost status is no longer active for this evaluation period.",
      entityId: result.history.id,
      entityType: "superhost_evaluation",
      link: "/host/dashboard",
      metadata: {
        evaluationDate: checkpoint.toISOString(),
        qualified: progress.eligibleNow,
        eligibilityStatus: progress.qualification.eligibilityStatus,
      },
    }).catch((error) => {
      console.warn("[superhost.service] Post-evaluation notification failed", error);
    });
  }

  return { history: result.history, progress, statusChanged };
}

/** Returns immutable, host-owned quarterly assessment records for the history view. */
export async function getSuperhostAssessmentHistory(hostId: string) {
  return prisma.superhostEvaluation.findMany({
    where: { hostId },
    orderBy: { evaluationDate: "desc" },
    take: 50,
  });
}

export async function runQuarterlySuperhostEvaluation(evaluationDate = new Date()) {
  const date = startOfUtcDay(evaluationDate);
  if (!isQuarterlyEvaluationCheckpoint(date) && !isQuarterlyAssessmentWindow(date)) {
    throw new Error("Superhost evaluation may only be run during a quarterly assessment window (Jan 1-7, Apr 1-7, Jul 1-7, Oct 1-7).");
  }
  const checkpoint = isQuarterlyEvaluationCheckpoint(date) ? date : getQuarterlyCheckpointForDate(date);
  const hosts = await prisma.user.findMany({
    // Ownership, not the display role, determines eligibility. This also
    // avoids accidentally excluding a valid listing owner during a role
    // migration while still excluding co-host-only accounts.
    where: { listings: { some: { deletedAt: null } } },
    select: { id: true },
  });

  const results: Array<{ hostId: string; success: boolean; statusChanged?: boolean; error?: string }> = [];
  const batchSize = 20;
  for (let index = 0; index < hosts.length; index += batchSize) {
    const batch = hosts.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (host: { id: string }) => {
        try {
          const res = await evaluateHostAtQuarterlyCheckpoint(host.id, checkpoint);
          return { hostId: host.id, success: true, statusChanged: res.statusChanged };
        } catch (err) {
          console.error(`[superhost.service] Quarterly evaluation failed for host ${host.id}:`, err);
          return {
            hostId: host.id,
            success: false,
            statusChanged: false,
            error: err instanceof Error ? err.message : "Evaluation failed",
          };
        }
      }),
    );
    results.push(...batchResults);
  }

  const successfulHosts = results.filter((r) => r.success).length;
  const failedHosts = results.filter((r) => !r.success).length;
  const statusChanges = results.filter((r) => r.success && r.statusChanged).length;

  console.info("[superhost.service] Quarterly evaluation completed", {
    evaluationDate: checkpoint.toISOString(),
    evaluatedHosts: results.length,
    successfulHosts,
    failedHosts,
    statusChanges,
  });

  return {
    evaluationDate: checkpoint,
    evaluatedHosts: results.length,
    successfulHosts,
    failedHosts,
    statusChanges,
    failures: results.filter((r) => !r.success).map((r) => ({ hostId: r.hostId, error: r.error })),
  };
}
