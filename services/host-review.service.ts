import "server-only";

import { ReviewStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { AppError } from "@/lib/api/errors";
import { extractStoredHostPayout } from "@/lib/booking/booking-financials";
import { bookingDateKey } from "@/lib/booking/booking-date";
import { getHostReviewEligibility } from "@/lib/booking/host-review-eligibility";
import { prisma } from "@/lib/db/prisma";
import { listingService } from "@/services/listing.service";

export type HostReviewContext = {
  bookingId: string;
  hostId: string;
  guest: { id: string; name: string; image: string | null };
  listing: {
    id: string;
    title: string;
    photos: string[];
    isGuestFavorite: boolean;
    overallRating: number | null;
  };
  stay: { startDate: string; endDate: string };
  payout: { amount: number; currency: string | null } | null;
  eligibility: {
    eligible: boolean;
    status: "REVIEW_PENDING" | "REVIEW_SUBMITTED" | "REVIEW_WINDOW_EXPIRED" | "NOT_ELIGIBLE";
    reason: string | null;
    reviewDeadline: string | null;
    reviewSubmitted: boolean;
  };
};

/**
 * Returns the single, host-scoped context used to enter the host review flow.
 * The booking ID is never trusted on its own: it is always constrained to
 * listings returned by the existing owner/accepted-co-host authorization path.
 */
export async function getHostReviewContext(
  actor: AuthUser,
  bookingId: string,
): Promise<HostReviewContext> {
  const { items: listings } = await listingService.listForHost(actor, { take: null });
  const listingIds = listings.map((listing) => listing.id);
  if (listingIds.length === 0) throw AppError.notFound("Reservation not found");

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      listingId: { in: listingIds },
    },
    select: {
      id: true,
      listingId: true,
      status: true,
      startDate: true,
      endDate: true,
      currency: true,
      cleaningFee: true,
      priceBreakdown: true,
      user: { select: { id: true, name: true, image: true } },
      hostGuestReview: { select: { submittedAt: true } },
      listing: {
        select: {
          id: true,
          title: true,
          photos: true,
          checkOutTime: true,
          isGuestFavorite: true,
        },
      },
    },
  });
  if (!booking) throw AppError.notFound("Reservation not found");

  const [reviewAggregate] = await Promise.all([
    prisma.review.aggregate({
      where: { listingId: booking.listingId, status: ReviewStatus.PUBLISHED },
      _avg: { rating: true },
    }),
  ]);
  const eligibility = getHostReviewEligibility({
    isAuthorizedHost: true,
    bookingStatus: booking.status,
    endDate: booking.endDate,
    checkOutTime: booking.listing.checkOutTime,
    hasHostReview: Boolean(booking.hostGuestReview),
    now: new Date(),
  });
  const payout = extractStoredHostPayout({
    priceBreakdown: booking.priceBreakdown,
    cleaningFee: booking.cleaningFee,
    currency: booking.currency,
  });

  return {
    bookingId: booking.id,
    hostId: actor.id,
    guest: {
      id: booking.user.id,
      name: booking.user.name || "Guest",
      image: booking.user.image,
    },
    listing: {
      id: booking.listing.id,
      title: booking.listing.title,
      photos: booking.listing.photos,
      isGuestFavorite: booking.listing.isGuestFavorite,
      overallRating: reviewAggregate._avg.rating === null
        ? null
        : Math.round(reviewAggregate._avg.rating * 100) / 100,
    },
    stay: {
      startDate: bookingDateKey(booking.startDate),
      endDate: bookingDateKey(booking.endDate),
    },
    payout: payout
      ? { amount: payout.netHostPayout, currency: payout.currency }
      : null,
    eligibility: {
      eligible: eligibility.eligible,
      status: eligibility.status,
      reason: eligibility.reason,
      reviewDeadline: eligibility.reviewDeadline?.toISOString() ?? null,
      reviewSubmitted: eligibility.reviewSubmitted,
    },
  };
}

export type SubmittedHostReviewDTO = {
  id: string;
  bookingId: string;
  hostId: string;
  guestId: string;
  cleanlinessRating: number;
  cleanlinessTags: string[];
  houseRulesRating: number;
  communicationRating: number;
  communicationTags: string[];
  publicReview: string | null;
  recommendGuest: boolean;
  privateNote: string | null;
  status: ReviewStatus;
  submittedAt: string;
  createdAt: string;
};

/**
 * Validates, authorizes, and atomically persists a Host -> Guest review.
 * Enforces:
 * - Session-derived host identity
 * - Property authorization via listingService.listForHost
 * - Stay completion & review window eligibility
 * - Complete input validation (ratings, boolean recommendation, text bounds)
 * - Single-submission guarantee via Prisma P2002 duplicate catching
 * - Asynchronous guest notification dispatch outside of DB writes
 */
export async function submitHostReview(
  actor: AuthUser,
  payload: unknown,
): Promise<{ success: true; review: SubmittedHostReviewDTO }> {
  const { validateHostReviewSubmission } = await import("@/lib/booking/host-review-draft");
  const validation = validateHostReviewSubmission(payload);
  if (!validation.valid || !validation.data) {
    const firstErrorMessage = Object.values(validation.errors)[0] || "Invalid review data";
    throw AppError.badRequest(firstErrorMessage);
  }

  const { data } = validation;

  // Authorize host against listing scope
  const { items: listings } = await listingService.listForHost(actor, { take: null });
  const listingIds = listings.map((l) => l.id);
  if (listingIds.length === 0) {
    throw AppError.notFound("Reservation not found");
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: data.bookingId,
      listingId: { in: listingIds },
    },
    select: {
      id: true,
      listingId: true,
      userId: true,
      status: true,
      startDate: true,
      endDate: true,
      listing: {
        select: {
          id: true,
          title: true,
          checkOutTime: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      hostGuestReview: {
        select: {
          id: true,
          submittedAt: true,
        },
      },
    },
  });

  if (!booking) {
    throw AppError.notFound("Reservation not found");
  }

  // Validate server-side review eligibility
  const eligibility = getHostReviewEligibility({
    isAuthorizedHost: true,
    bookingStatus: booking.status,
    endDate: booking.endDate,
    checkOutTime: booking.listing.checkOutTime,
    hasHostReview: Boolean(booking.hostGuestReview),
    now: new Date(),
  });

  if (!eligibility.eligible) {
    if (eligibility.status === "REVIEW_SUBMITTED") {
      throw AppError.conflict("A review has already been submitted for this reservation.");
    }
    if (eligibility.status === "REVIEW_WINDOW_EXPIRED") {
      throw AppError.badRequest("The review window for this reservation has expired.");
    }
    throw AppError.badRequest(eligibility.reason || "This reservation is not eligible for review.");
  }

  // Persist atomically
  let created;
  try {
    created = await prisma.hostGuestReview.create({
      data: {
        bookingId: booking.id,
        hostId: actor.id,
        guestId: booking.userId,
        cleanlinessRating: data.cleanlinessRating,
        cleanlinessTags: data.cleanlinessTags,
        houseRulesRating: data.houseRulesRating,
        communicationRating: data.communicationRating,
        communicationTags: data.communicationTags,
        publicReview: data.publicReview || null,
        recommendGuest: data.recommendGuest,
        privateNote: data.privateNote || null,
        status: ReviewStatus.PUBLISHED,
      },
      select: {
        id: true,
        bookingId: true,
        hostId: true,
        guestId: true,
        cleanlinessRating: true,
        cleanlinessTags: true,
        houseRulesRating: true,
        communicationRating: true,
        communicationTags: true,
        publicReview: true,
        recommendGuest: true,
        privateNote: true,
        status: true,
        submittedAt: true,
        createdAt: true,
      },
    });
  } catch (err: unknown) {
    // Unique constraint on bookingId violation
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw AppError.conflict("A review has already been submitted for this reservation.");
    }
    throw err;
  }

  // Notify guest asynchronously outside of DB write
  try {
    const { notificationService } = await import("@/services/notification.service");
    const { NotificationType } = await import("@/generated/prisma/enums");
    await notificationService.create({
      userId: booking.userId,
      type: NotificationType.BOOKING,
      title: "You received a review from your host",
      message: `${actor.name || "Your host"} left a review for your stay at ${booking.listing.title}.`,
      entityId: booking.id,
      entityType: "HOST_REVIEW",
      link: "/trips",
    });
  } catch (notifErr) {
    console.warn("Failed to notify guest of host review submission:", notifErr);
  }

  return {
    success: true,
    review: {
      ...created,
      submittedAt: created.submittedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export type GuestHostReviewStats = {
  totalReviews: number;
  recommendedCount: number;
  notRecommendedCount: number;
  recommendationRate: number | null;
  averageCleanlinessRating: number | null;
  averageHouseRulesRating: number | null;
  averageCommunicationRating: number | null;
  overallAverageRating: number | null;
};

/**
 * Calculates guest recommendation statistics and host review aggregates.
 * Excludes draft/unsubmitted reviews and handles Yes/No counts properly.
 */
type GuestReviewRow = {
  recommendGuest: boolean;
  cleanlinessRating: number;
  houseRulesRating: number;
  communicationRating: number;
};

export async function getGuestHostReviewStats(guestId: string): Promise<GuestHostReviewStats> {
  const reviews = await prisma.hostGuestReview.findMany({
    where: {
      guestId,
      status: ReviewStatus.PUBLISHED,
    },
    select: {
      recommendGuest: true,
      cleanlinessRating: true,
      houseRulesRating: true,
      communicationRating: true,
    },
  });

  const totalReviews = reviews.length;
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      recommendedCount: 0,
      notRecommendedCount: 0,
      recommendationRate: null,
      averageCleanlinessRating: null,
      averageHouseRulesRating: null,
      averageCommunicationRating: null,
      overallAverageRating: null,
    };
  }

  const recommendedCount = reviews.filter((r: GuestReviewRow) => r.recommendGuest === true).length;
  const notRecommendedCount = totalReviews - recommendedCount;
  const recommendationRate = Math.round((recommendedCount / totalReviews) * 100);

  const cleanlinessSum = reviews.reduce((acc: number, r: GuestReviewRow) => acc + r.cleanlinessRating, 0);
  const houseRulesSum = reviews.reduce((acc: number, r: GuestReviewRow) => acc + r.houseRulesRating, 0);
  const communicationSum = reviews.reduce((acc: number, r: GuestReviewRow) => acc + r.communicationRating, 0);

  const averageCleanlinessRating = Math.round((cleanlinessSum / totalReviews) * 100) / 100;
  const averageHouseRulesRating = Math.round((houseRulesSum / totalReviews) * 100) / 100;
  const averageCommunicationRating = Math.round((communicationSum / totalReviews) * 100) / 100;
  const overallAverageRating =
    Math.round(((averageCleanlinessRating + averageHouseRulesRating + averageCommunicationRating) / 3) * 100) / 100;

  return {
    totalReviews,
    recommendedCount,
    notRecommendedCount,
    recommendationRate,
    averageCleanlinessRating,
    averageHouseRulesRating,
    averageCommunicationRating,
    overallAverageRating,
  };
}

/**
 * Fetches an authorized host-to-guest review while respecting the visibility matrix:
 * - Author (host) and subject (guest): can view all fields including privateNote
 * - Other hosts: can view ratings, public review, recommendation; privateNote is redacted (null)
 * - Public / unauthenticated: forbidden
 */
export async function getHostGuestReview(
  actor: AuthUser,
  bookingId: string,
): Promise<SubmittedHostReviewDTO> {
  const review = await prisma.hostGuestReview.findUnique({
    where: { bookingId },
    select: {
      id: true,
      bookingId: true,
      hostId: true,
      guestId: true,
      cleanlinessRating: true,
      cleanlinessTags: true,
      houseRulesRating: true,
      communicationRating: true,
      communicationTags: true,
      publicReview: true,
      recommendGuest: true,
      privateNote: true,
      status: true,
      submittedAt: true,
      createdAt: true,
    },
  });

  if (!review) {
    throw AppError.notFound("Review not found");
  }

  const isAuthor = actor.id === review.hostId;
  const isSubject = actor.id === review.guestId;
  const isOtherHostOrAdmin = actor.role === "HOST" || actor.role === "ADMIN";

  if (!isAuthor && !isSubject && !isOtherHostOrAdmin) {
    throw AppError.forbidden("You do not have permission to view this review");
  }

  // Redact private note for anyone other than author and subject
  const privateNote = (isAuthor || isSubject) ? review.privateNote : null;

  return {
    ...review,
    privateNote,
    submittedAt: review.submittedAt.toISOString(),
    createdAt: review.createdAt.toISOString(),
  };
}

/**
 * Fetches reviews received by a guest respecting the visibility matrix:
 * - Subject guest: can view ratings, public review, recommendation, and private notes addressed to them
 * - Other hosts / admins: can view ratings, public review, and recommendation; private notes are strictly redacted
 * - Other users / general public: forbidden
 */
export async function getHostGuestReviewsForGuest(
  actor: AuthUser,
  guestId: string,
): Promise<{ stats: GuestHostReviewStats; reviews: SubmittedHostReviewDTO[] }> {
  const isSubject = actor.id === guestId;
  const isHostOrAdmin = actor.role === "HOST" || actor.role === "ADMIN";

  if (!isSubject && !isHostOrAdmin) {
    throw AppError.forbidden("You do not have permission to view reviews for this guest");
  }

  const reviews = await prisma.hostGuestReview.findMany({
    where: {
      guestId,
      status: ReviewStatus.PUBLISHED,
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      bookingId: true,
      hostId: true,
      guestId: true,
      cleanlinessRating: true,
      cleanlinessTags: true,
      houseRulesRating: true,
      communicationRating: true,
      communicationTags: true,
      publicReview: true,
      recommendGuest: true,
      privateNote: true,
      status: true,
      submittedAt: true,
      createdAt: true,
    },
  });

  const stats = await getGuestHostReviewStats(guestId);

  type HostGuestReviewItem = {
    id: string;
    bookingId: string;
    hostId: string;
    guestId: string;
    cleanlinessRating: number;
    cleanlinessTags: string[];
    houseRulesRating: number;
    communicationRating: number;
    communicationTags: string[];
    publicReview: string | null;
    recommendGuest: boolean;
    privateNote: string | null;
    status: ReviewStatus;
    submittedAt: Date;
    createdAt: Date;
  };

  const sanitizedReviews: SubmittedHostReviewDTO[] = (reviews as HostGuestReviewItem[]).map((r: HostGuestReviewItem) => ({
    ...r,
    privateNote: (actor.id === r.hostId || actor.id === r.guestId) ? r.privateNote : null,
    submittedAt: r.submittedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return { stats, reviews: sanitizedReviews };
}
