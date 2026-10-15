import "server-only";

import { ReviewDirection } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { AppError } from "@/lib/api/errors";
import { extractStoredHostPayout } from "@/lib/booking/booking-financials";
import { bookingDateKey } from "@/lib/booking/booking-date";
import { evaluateHostReviewEligibility } from "@/lib/booking/review-eligibility";
import { prisma } from "@/lib/db/prisma";
import { listingService } from "@/services/listing.service";
import { reviewService } from "@/services/review.service";

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
 * Returns the host-scoped context used to enter the host review flow.
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
    include: {
      user: { select: { id: true, name: true, image: true } },
      listing: {
        select: {
          id: true,
          title: true,
          photos: true,
          isGuestFavorite: true,
          checkOutTime: true,
        },
      },
    },
  });

  if (!booking) throw AppError.notFound("Reservation not found");

  const [existingHostReview, existingGuestReview, stats] = await Promise.all([
    prisma.review.findFirst({
      where: { bookingId, direction: ReviewDirection.HOST_TO_GUEST },
      select: { id: true },
    }),
    prisma.review.findFirst({
      where: { bookingId, direction: ReviewDirection.GUEST_TO_PROPERTY },
      select: { id: true },
    }),
    reviewService.getReviewStats(booking.listing.id),
  ]);

  const rawEligibility = evaluateHostReviewEligibility({
    isHost: true,
    bookingStatus: booking.status,
    endDate: booking.endDate,
    checkOutTime: booking.listing.checkOutTime,
    hasHostReview: Boolean(existingHostReview),
    hasGuestReview: Boolean(existingGuestReview),
  });

  let status: HostReviewContext["eligibility"]["status"] = "NOT_ELIGIBLE";
  if (rawEligibility.status === "ELIGIBLE") status = "REVIEW_PENDING";
  else if (rawEligibility.status === "ALREADY_SUBMITTED") status = "REVIEW_SUBMITTED";
  else if (rawEligibility.status === "WINDOW_EXPIRED") status = "REVIEW_WINDOW_EXPIRED";

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
      overallRating: stats.averageRating,
    },
    stay: {
      startDate: bookingDateKey(booking.startDate),
      endDate: bookingDateKey(booking.endDate),
    },
    payout: (() => {
      const stored = extractStoredHostPayout(booking);
      return stored ? { amount: stored.netHostPayout, currency: stored.currency } : null;
    })(),
    eligibility: {
      eligible: rawEligibility.eligible,
      status,
      reason: rawEligibility.reason,
      reviewDeadline: rawEligibility.reviewDeadline ? rawEligibility.reviewDeadline.toISOString() : null,
      reviewSubmitted: Boolean(existingHostReview),
    },
  };
}

