import "server-only";

import { BookingStatus, Role, UserStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { differenceInBookingNights } from "@/lib/booking/booking-date";
import { computeBookingStatus } from "@/lib/booking/booking-status";
import { incrCounter } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import {
  evaluateSuperhostRequirements,
  getLiveSuperhostWindow,
  getNextQuarterlyEvaluationDate,
  getQuarterlySuperhostWindow,
  isQuarterlyEvaluationCheckpoint,
  startOfUtcDay,
} from "@/lib/superhost/rules";
import { messagingService } from "@/services/messaging.service";
import { notificationService } from "@/services/notification.service";

export {
  evaluateSuperhostRequirements,
  getLiveSuperhostWindow,
  getNextQuarterlyEvaluationDate,
  getQuarterlySuperhostWindow,
  isQuarterlyEvaluationCheckpoint,
  startOfUtcDay,
} from "@/lib/superhost/rules";

export interface SuperhostProgress {
  windowStart: Date;
  windowEnd: Date;
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
  eligibleNow: boolean;
  failureReasons: string[];
}

export interface SuperhostStatus extends SuperhostProgress {
  officialStatus: boolean;
  qualifiedAt: Date | null;
  lastEvaluatedAt: Date | null;
  nextEvaluationAt: Date;
}


function isNonExcludedHostCancellation(priceBreakdown: unknown): boolean {
  if (!priceBreakdown || typeof priceBreakdown !== "object" || Array.isArray(priceBreakdown)) return false;
  const cancellation = (priceBreakdown as Record<string, unknown>).cancellation;
  if (!cancellation || typeof cancellation !== "object" || Array.isArray(cancellation)) return false;
  const details = cancellation as Record<string, unknown>;
  return details.cancelledBy === "HOST" && details.isExcluded !== true;
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
    select: { id: true, checkInStart: true, checkOutTime: true },
  }) as Array<{ id: string; checkInStart: string | null; checkOutTime: string | null }>;
  const listingIds = listings.map((listing) => listing.id);
  const listingSchedule = new Map<string, { id: string; checkInStart: string | null; checkOutTime: string | null }>(
    listings.map((listing) => [listing.id, listing]),
  );

  if (listingIds.length === 0) {
    return emptyProgress(window, host.status === UserStatus.ACTIVE);
  }

  const reviewWindowEndExclusive = new Date(window.windowEnd);
  reviewWindowEndExclusive.setUTCDate(reviewWindowEndExclusive.getUTCDate() + 1);
  const [bookings, reviewSummary, messagingMetrics] = await Promise.all([
    prisma.booking.findMany({
      where: {
        listingId: { in: listingIds },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
        endDate: { gte: window.windowStart, lte: window.windowEnd },
      },
      select: { id: true, listingId: true, status: true, startDate: true, endDate: true, priceBreakdown: true },
    }),
    prisma.review.aggregate({
      where: {
        listingId: { in: listingIds },
        status: "PUBLISHED",
        createdAt: { gte: window.windowStart, lt: reviewWindowEndExclusive },
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    messagingService.calculateHostResponseMetrics(hostId, 12, asOf),
  ]);

  let completedReservationsCount = 0;
  let completedNightsCount = 0;
  let hostCancellationCount = 0;
  for (const booking of bookings) {
    if (booking.status === BookingStatus.CANCELLED) {
      if (isNonExcludedHostCancellation(booking.priceBreakdown)) hostCancellationCount++;
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
  const accountGoodStanding = host.status === UserStatus.ACTIVE;
  const requirements = evaluateSuperhostRequirements({
    completedReservationsCount,
    completedNightsCount,
    overallRating,
    responseRatePercentage: messagingMetrics.responseRatePercentage,
    hostCancellationCount,
    cancellationDenominator,
    accountGoodStanding,
  });

  return {
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
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
    accountGoodStanding,
    accountStandingMet: accountGoodStanding,
    eligibleNow: requirements.eligibleNow,
    failureReasons: requirements.failureReasons,
  };
}

function emptyProgress(window: { windowStart: Date; windowEnd: Date }, accountGoodStanding: boolean): SuperhostProgress {
  return {
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    completedReservationsCount: 0,
    completedNightsCount: 0,
    hostingVolume: { reservationPathMet: false, longStayPathMet: false, met: false },
    overallRating: null,
    publishedReviewCount: 0,
    ratingMet: false,
    responseRatePercentage: null,
    totalGuestInquiries: 0,
    respondedWithin24hCount: 0,
    averageResponseTimeMinutes: null,
    responseRateMet: false,
    hostCancellationRatePercentage: 0,
    hostCancellationCount: 0,
    cancellationDenominator: 0,
    cancellationMet: true,
    accountGoodStanding,
    accountStandingMet: accountGoodStanding,
    eligibleNow: false,
    failureReasons: ["Hosting volume requirement is not met.", "A published review average of at least 4.80 is required.", "Response rate is unavailable until there is a qualifying guest inquiry."],
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
  const checkpoint = startOfUtcDay(evaluationDate);
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

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const history = await tx.superhostEvaluation.upsert({
      where: { hostId_evaluationDate: { hostId, evaluationDate: checkpoint } },
      create: {
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
        qualified: progress.eligibleNow,
        failureReasons: progress.failureReasons,
      },
      update: {
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
        qualified: progress.eligibleNow,
        failureReasons: progress.failureReasons,
      },
    });
    await tx.user.update({
      where: { id: hostId },
      data: {
        isSuperhost: progress.eligibleNow,
        superhostQualifiedAt: progress.eligibleNow ? previous.superhostQualifiedAt ?? checkpoint : null,
        superhostLastEvaluatedAt: checkpoint,
        superhostNextEvaluationAt: getNextQuarterlyEvaluationDate(checkpoint),
      },
    });
    return history;
  });

  const statusChanged = previous.isSuperhost !== progress.eligibleNow;
  if (statusChanged) {
    // Public listing and discovery cards read the persisted badge, so invalidate
    // their versioned cache only when an official quarterly status changes.
    await incrCounter(keys.listingsPublicVersion());
    await notificationService.create({
      userId: hostId,
      type: "SYSTEM",
      title: progress.eligibleNow ? "You are now a Superhost" : "Your Superhost status changed",
      message: progress.eligibleNow
        ? "Your official Superhost status is active for this evaluation period."
        : "Your official Superhost status is no longer active for this evaluation period.",
      entityId: result.id,
      entityType: "superhost_evaluation",
      link: "/host/dashboard",
      metadata: { evaluationDate: checkpoint.toISOString(), qualified: progress.eligibleNow },
    });
  }

  return { history, progress, statusChanged };
}

export async function runQuarterlySuperhostEvaluation(evaluationDate = new Date()) {
  const checkpoint = startOfUtcDay(evaluationDate);
  if (!isQuarterlyEvaluationCheckpoint(checkpoint)) {
    throw new Error("Superhost evaluation may only be run on a quarterly checkpoint.");
  }
  const hosts = await prisma.user.findMany({
    where: { role: Role.HOST, listings: { some: { deletedAt: null } } },
    select: { id: true },
  });
  // Keep database pressure bounded while evaluating the entire owner set. The
  // per-host evaluator is intentionally reusable for a single host and tests.
  const results = [];
  const batchSize = 20;
  for (let index = 0; index < hosts.length; index += batchSize) {
    const batch = hosts.slice(index, index + batchSize);
    results.push(...await Promise.all(
      batch.map((host: { id: string }) => evaluateHostAtQuarterlyCheckpoint(host.id, checkpoint)),
    ));
  }
  return { evaluationDate: checkpoint, evaluatedHosts: results.length, statusChanges: results.filter((result) => result.statusChanged).length };
}
