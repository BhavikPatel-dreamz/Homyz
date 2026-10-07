import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { BookingStatus, ListingStatus } from "@/generated/prisma/enums";
import { computeBookingStatus } from "@/lib/booking/booking-status";
import { prisma } from "@/lib/db/prisma";
import { incrCounter } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import {
  evaluateGuestFavoriteRequirements,
  GUEST_FAVORITE_CATEGORY_KEYS,
  startOfUtcDay,
  type GuestFavoriteCategoryKey,
  type GuestFavoriteCategoryMetric,
} from "@/lib/guest-favorite/rules";
import { notificationService } from "@/services/notification.service";

export type GuestFavoriteProgress = {
  publishedReviewCount: number;
  overallRating: number | null;
  categoryRatings: Record<GuestFavoriteCategoryKey, GuestFavoriteCategoryMetric>;
  totalBookings: number;
  hostCancellationCount: number;
  reliabilityFailureRatePercentage: number;
  minimumReviewsMet: boolean;
  overallRatingMet: boolean;
  subratingCoverageMet: boolean;
  subratingConsistencyMet: boolean;
  reliabilityMet: boolean;
  qualityIncidentDataStatus: "DATA_UNAVAILABLE";
  qualityIncidentMessage: string;
  eligibleNow: boolean;
  failureReasons: string[];
};

export type GuestFavoriteStatus = GuestFavoriteProgress & {
  officialStatus: boolean;
  since: Date | null;
  lastEvaluatedAt: Date | null;
};

type ListingEvaluationData = {
  id: string;
  hostId: string;
  isGuestFavorite: boolean;
  guestFavoriteSince: Date | null;
  guestFavoriteLastEvaluatedAt: Date | null;
  checkInStart: string | null;
  checkOutTime: string | null;
  reviews: Array<{
    rating: number;
    cleanlinessRating: number | null;
    accuracyRating: number | null;
    checkInRating: number | null;
    communicationRating: number | null;
    locationRating: number | null;
    valueRating: number | null;
  }>;
  bookings: Array<{
    status: BookingStatus;
    startDate: Date;
    endDate: Date;
    priceBreakdown: unknown;
  }>;
};

const categoryField: Record<GuestFavoriteCategoryKey, keyof ListingEvaluationData["reviews"][number]> = {
  cleanliness: "cleanlinessRating",
  accuracy: "accuracyRating",
  checkIn: "checkInRating",
  communication: "communicationRating",
  location: "locationRating",
  value: "valueRating",
};

function isNonExcludedHostCancellation(priceBreakdown: unknown): boolean {
  if (!priceBreakdown || typeof priceBreakdown !== "object" || Array.isArray(priceBreakdown)) return false;
  const cancellation = (priceBreakdown as Record<string, unknown>).cancellation;
  if (!cancellation || typeof cancellation !== "object" || Array.isArray(cancellation)) return false;
  const details = cancellation as Record<string, unknown>;
  return details.cancelledBy === "HOST" && details.isExcluded !== true;
}

export function calculateGuestFavoriteProgress(data: ListingEvaluationData, asOf = new Date()): GuestFavoriteProgress {
  const categoryRatings = Object.fromEntries(GUEST_FAVORITE_CATEGORY_KEYS.map((category) => {
    const values = data.reviews
      .map((review) => review[categoryField[category]])
      .filter((value): value is number => typeof value === "number");
    return [category, {
      average: values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null,
      reviewCount: values.length,
    }];
  })) as Record<GuestFavoriteCategoryKey, GuestFavoriteCategoryMetric>;
  const overallRating = data.reviews.length > 0
    ? Math.round((data.reviews.reduce((sum, review) => sum + review.rating, 0) / data.reviews.length) * 100) / 100
    : null;

  let totalBookings = 0;
  let hostCancellationCount = 0;
  for (const booking of data.bookings) {
    if (booking.status === BookingStatus.CANCELLED) {
      totalBookings++;
      if (isNonExcludedHostCancellation(booking.priceBreakdown)) hostCancellationCount++;
      continue;
    }
    const status = computeBookingStatus({
      dbStatus: booking.status,
      startDate: booking.startDate,
      endDate: booking.endDate,
      checkInStart: data.checkInStart,
      checkOutTime: data.checkOutTime,
      now: asOf,
    });
    if (status.status === "COMPLETED") totalBookings++;
  }

  const requirements = evaluateGuestFavoriteRequirements({
    publishedReviewCount: data.reviews.length,
    overallRating,
    categoryRatings,
    totalBookings,
    hostCancellationCount,
  });
  return {
    publishedReviewCount: data.reviews.length,
    overallRating,
    categoryRatings,
    totalBookings,
    hostCancellationCount,
    reliabilityFailureRatePercentage: requirements.reliabilityFailureRatePercentage,
    minimumReviewsMet: requirements.minimumReviewsMet,
    overallRatingMet: requirements.overallRatingMet,
    subratingCoverageMet: requirements.subratingCoverageMet,
    subratingConsistencyMet: requirements.subratingConsistencyMet,
    reliabilityMet: requirements.reliabilityMet,
    qualityIncidentDataStatus: "DATA_UNAVAILABLE",
    qualityIncidentMessage: "Property-level support and quality incident tracking is not currently instrumented.",
    eligibleNow: requirements.eligibleNow,
    failureReasons: requirements.failureReasons,
  };
}

const evaluationInclude = {
  reviews: {
    where: { status: "PUBLISHED" as const },
    select: {
      rating: true,
      cleanlinessRating: true,
      accuracyRating: true,
      checkInRating: true,
      communicationRating: true,
      locationRating: true,
      valueRating: true,
    },
  },
  bookings: {
    where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] } },
    select: { status: true, startDate: true, endDate: true, priceBreakdown: true },
  },
} satisfies Prisma.ListingInclude;

async function loadListingEvaluationData(listingId: string): Promise<ListingEvaluationData | null> {
  return prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      hostId: true,
      isGuestFavorite: true,
      guestFavoriteSince: true,
      guestFavoriteLastEvaluatedAt: true,
      checkInStart: true,
      checkOutTime: true,
      ...evaluationInclude,
    },
  }) as Promise<ListingEvaluationData | null>;
}

export async function getGuestFavoriteStatus(listingId: string, asOf = new Date()): Promise<GuestFavoriteStatus | null> {
  const listing = await loadListingEvaluationData(listingId);
  if (!listing) return null;
  return {
    ...calculateGuestFavoriteProgress(listing, asOf),
    officialStatus: listing.isGuestFavorite,
    since: listing.guestFavoriteSince,
    lastEvaluatedAt: listing.guestFavoriteLastEvaluatedAt,
  };
}

async function persistDailyEvaluation(listing: ListingEvaluationData, evaluationDate: Date, asOf: Date) {
  const progress = calculateGuestFavoriteProgress(listing, asOf);
  const history = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const record = await tx.guestFavoriteEvaluation.upsert({
      where: { listingId_evaluationDate: { listingId: listing.id, evaluationDate } },
      create: {
        listingId: listing.id,
        evaluationDate,
        publishedReviewCount: progress.publishedReviewCount,
        overallRating: progress.overallRating,
        subratings: progress.categoryRatings,
        totalBookings: progress.totalBookings,
        hostCancellationCount: progress.hostCancellationCount,
        reliabilityFailureRatePercentage: progress.reliabilityFailureRatePercentage,
        qualityIncidentDataStatus: progress.qualityIncidentDataStatus,
        qualified: progress.eligibleNow,
        failureReasons: progress.failureReasons,
      },
      update: {
        publishedReviewCount: progress.publishedReviewCount,
        overallRating: progress.overallRating,
        subratings: progress.categoryRatings,
        totalBookings: progress.totalBookings,
        hostCancellationCount: progress.hostCancellationCount,
        reliabilityFailureRatePercentage: progress.reliabilityFailureRatePercentage,
        qualityIncidentDataStatus: progress.qualityIncidentDataStatus,
        qualified: progress.eligibleNow,
        failureReasons: progress.failureReasons,
      },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        isGuestFavorite: progress.eligibleNow,
        guestFavoriteSince: progress.eligibleNow ? listing.guestFavoriteSince ?? evaluationDate : null,
        guestFavoriteLastEvaluatedAt: evaluationDate,
      },
    });
    return record;
  });
  const statusChanged = listing.isGuestFavorite !== progress.eligibleNow;
  if (statusChanged) {
    await incrCounter(keys.listingsPublicVersion());
    await notificationService.create({
      userId: listing.hostId,
      type: "SYSTEM",
      title: progress.eligibleNow ? "Your listing is now a Guest Favorite" : "Your Guest Favorite badge changed",
      message: progress.eligibleNow
        ? "This listing now has an official Guest Favorite badge."
        : "This listing no longer has an official Guest Favorite badge.",
      entityId: history.id,
      entityType: "guest_favorite_evaluation",
      link: "/host/dashboard",
      metadata: { listingId: listing.id, evaluationDate: evaluationDate.toISOString(), qualified: progress.eligibleNow },
    });
  }
  return { history, progress, statusChanged };
}

export async function evaluateListingGuestFavoriteDaily(listingId: string, asOf = new Date()) {
  const listing = await loadListingEvaluationData(listingId);
  if (!listing) throw new Error("Listing not found");
  return persistDailyEvaluation(listing, startOfUtcDay(asOf), asOf);
}

export async function runDailyGuestFavoriteEvaluation(asOf = new Date()) {
  const evaluationDate = startOfUtcDay(asOf);
  const inactive = await prisma.listing.updateMany({
    where: {
      isGuestFavorite: true,
      OR: [
        { published: false },
        { status: { not: ListingStatus.ACTIVE } },
        { isPaused: true },
        { deletedAt: { not: null } },
      ],
    },
    data: { isGuestFavorite: false, guestFavoriteSince: null },
  });
  const results: Array<{ statusChanged: boolean }> = [];
  const listingPageSize = 100;
  const evaluationBatchSize = 20;
  let cursor: string | undefined;
  while (true) {
    // Page the selected review/booking rows so a large marketplace does not
    // retain every listing's history in memory during the daily run.
    const listings = await prisma.listing.findMany({
      where: { published: true, status: ListingStatus.ACTIVE, isPaused: false, deletedAt: null },
      orderBy: { id: "asc" },
      take: listingPageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        hostId: true,
        isGuestFavorite: true,
        guestFavoriteSince: true,
        guestFavoriteLastEvaluatedAt: true,
        checkInStart: true,
        checkOutTime: true,
        ...evaluationInclude,
      },
    }) as ListingEvaluationData[];
    if (listings.length === 0) break;
    for (let index = 0; index < listings.length; index += evaluationBatchSize) {
      results.push(...await Promise.all(
        listings.slice(index, index + evaluationBatchSize).map((listing) => persistDailyEvaluation(listing, evaluationDate, asOf)),
      ));
    }
    if (listings.length < listingPageSize) break;
    cursor = listings[listings.length - 1].id;
  }
  if (inactive.count > 0) await incrCounter(keys.listingsPublicVersion());
  return {
    evaluationDate,
    evaluatedListings: results.length,
    inactiveBadgesRemoved: inactive.count,
    statusChanges: results.filter((result) => result.statusChanged).length + inactive.count,
  };
}
