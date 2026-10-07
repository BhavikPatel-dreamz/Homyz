import "server-only";

import { prisma } from "@/lib/db/prisma";
import { BookingStatus, Role, UserStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { authorize } from "@/lib/permissions/authorize";
import { assertHostPermission } from "@/lib/permissions/host-permissions-server";
import { listingService } from "@/services/listing.service";
import { getLiveSuperhostStatus, getNextQuarterlyEvaluationDate } from "@/services/superhost.service";
import { evaluateGuestFavoriteRequirements } from "@/lib/guest-favorite/rules";
import { bookingDateKey, differenceInBookingNights, parseBookingDate, shiftBookingDateKey } from "@/lib/booking/booking-date";
import { computeBookingStatus } from "@/lib/booking/booking-status";
import {
  extractRecordedCancellationRefund,
  extractStoredGuestTotal,
  extractStoredHostPayout,
  isStoredBookingPayoutEligible,
} from "@/lib/booking/booking-financials";
import { AppError } from "@/lib/api/errors";
import {
  buildHostDashboardRecommendations,
  type HostDashboardRecommendation,
} from "@/lib/dashboard/host-recommendations";

export interface HostDashboardEarnings {
  monthlyEarningsCents: number;
  ytdEarningsCents: number;
  upcomingPayoutsCents: number;
  completedPayoutsCents: number;
  currency: string;
  refunds: {
    amountCents: number;
    count: number;
    periodLabel: "All recorded cancellations";
    source: "BOOKING_CANCELLATION_SNAPSHOT";
  };
  adjustments: {
    status: "DATA_UNAVAILABLE";
    message: "Payout and booking adjustments are not currently stored in a financial ledger.";
  };
  bookingsWithoutPayoutSnapshotCount: number;
  bookingsExcludedForPaymentStatusCount: number;
  itemizedBreakdown: {
    accommodationSubtotalCents: number;
    extraGuestFeeCents: number;
    petFeeCents: number;
    cleaningFeeCents: number;
    hostServiceFeeCents: number;
    taxesCollectedForHostCents: number;
    netHostPayoutCents: number;
  };
}

export interface HostDashboardReviews {
  overallRating: number | null;
  totalReviewsCount: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  categoryRatings: {
    cleanliness: number | null;
    accuracy: number | null;
    checkIn: number | null;
    communication: number | null;
    location: number | null;
    value: number | null;
  };
  trend: Array<{ month: string; averageRating: number | null; reviewCount: number }>;
  recentReviews: Array<{
    id: string;
    guestName: string;
    listingTitle: string;
    rating: number;
    comment: string;
    createdAt: string;
  }>;
}

export interface HostDashboardGuestAnalytics {
  uniqueGuestsCount: number;
  completedGuestStaysCount: number;
  returningGuestsCount: number;
  returningGuestsPercentage: number;
  guestOriginCountries: Array<{ country: string; guestCount: number; sharePercentage: number }>;
  guestOrigins: Array<{ country: string; city: string | null; stayCount: number; sharePercentage: number }>;
  staysWithoutRecordedOriginCount: number;
  checkInInstructionsViewed: {
    status: "DATA_UNAVAILABLE";
    message: "Check-in instructions viewed tracking is not currently instrumented in the event database.";
  };
}

export interface HostDashboardSuperhostEvaluation {
  /** Stored official badge state; it changes only during a quarterly run. */
  officialStatus: boolean;
  lastEvaluatedAt: string | null;
  nextEvaluationAt: string;
  /** Live 12-month progress. It never awards or removes the official badge. */
  currentProgress: {
    completedReservationsCount: number;
    completedNightsCount: number;
    reservationPathMet: boolean;
    longStayPathMet: boolean;
    hostingVolumeMet: boolean;
    overallRating: number | null;
    publishedReviewCount: number;
    ratingMet: boolean;
    responseRatePercentage: number | null;
    responseRateMet: boolean;
    hostCancellationRatePercentage: number;
    hostCancellationCount: number;
    cancellationDenominator: number;
    cancellationMet: boolean;
    accountGoodStanding: boolean;
    accountStandingMet: boolean;
    eligibleNow: boolean;
  };
  /** @deprecated Use currentProgress. Kept for compatibility with the prior dashboard DTO. */
  isQualified: boolean;
  evaluatedWindowMonths: 12;
  windowStart: string;
  windowEnd: string;
  metrics: {
    completedReservationsCount: number;
    requiredReservationsCount: 10;
    completedNightsCount: number;
    meetsReservationOrNightsThreshold: boolean;
    overallRating: number | null;
    requiredRating: 4.8;
    meetsRatingThreshold: boolean;
    responseRatePercentage: number | null;
    requiredResponseRatePercentage: 90;
    meetsResponseRateThreshold: boolean;
    hostCancellationRatePercentage: number;
    maxPermittedCancellationRatePercentage: 1.0;
    meetsCancellationThreshold: boolean;
    accountGoodStanding: boolean;
    activeListingCount: number;
  };
  gaps: string[];
}

export interface HostDashboardGuestFavoriteListingItem {
  listingId: string;
  title: string;
  status: string;
  published: boolean;
  officialStatus: boolean;
  guestFavoriteSince: string | null;
  lastEvaluatedAt: string | null;
  totalBookings: number;
  completedStays: number;
  reviewsCount: number;
  overallRating: number | null;
  categoryRatings: {
    cleanliness: number | null;
    accuracy: number | null;
    checkIn: number | null;
    communication: number | null;
    location: number | null;
    value: number | null;
  };
  hostCancellations: number;
  reliabilityFailureRatePercentage: number;
  minimumReviewsMet: boolean;
  overallRatingMet: boolean;
  subratingCoverageMet: boolean;
  subratingConsistencyMet: boolean;
  reliabilityMet: boolean;
  qualityIssuesReported: {
    status: "DATA_UNAVAILABLE";
    message: "Property-level support/quality incident tracking is not currently instrumented.";
  };
  eligibleNow: boolean;
}

export interface HostDashboardListingPerformance {
  totalListings: number;
  activeListings: number;
  draftListings: number;
  pausedListings: number;
  pageViews: {
    status: "DATA_UNAVAILABLE";
    message: "Individual listing impression and page view logging is not currently instrumented in database.";
  };
  conversionRate: {
    status: "DATA_UNAVAILABLE";
    message: "Search-to-booking funnel conversion event tracking is not currently instrumented in database.";
  };
}

export interface HostDashboardListingHealthItem {
  listingId: string;
  title: string;
  status: string;
  published: boolean;
  isPaused: boolean;
  photoCount: number;
  amenityCount: number;
  completedChecks: number;
  totalChecks: number;
  missingFields: string[];
}

export interface HostDashboardListingHealth {
  responseRatePercentage: number | null;
  averageResponseTimeMinutes: number | null;
  totalGuestInquiries: number;
  listings: HostDashboardListingHealthItem[];
}

export interface HostDashboardKPIs {
  periodLabel: string;
  monthlyEarnings: {
    amountCents: number;
    currency: string;
    periodLabel: string;
    previousMonthAmountCents: number;
    changePercentage: number | null;
  };
  ytdEarnings: {
    amountCents: number;
    currency: string;
    periodLabel: string;
  };
  upcomingPayout: {
    totalUpcomingAmountCents: number;
    currency: string;
    nextPayoutAmountCents: number | null;
    nextEligibleStayStartDate: string | null;
    nextPayoutListingTitle: string | null;
    nextPayoutGuestName: string | null;
    count: number;
    excludedForPaymentStatusCount: number;
    periodLabel: string;
  };
  occupancy: {
    ratePercentage: number;
    bookedNights: number;
    availableNights: number;
    totalBookableNights: number;
    blockedNights: number;
    periodLabel: string;
  };
  averageBookingValue: {
    hostPayoutCents: number | null;
    guestTotalCents: number;
    currency: string;
    completedBookingsCount: number;
    periodLabel: string;
  };
  averageStayLength: {
    nights: number;
    completedStaysCount: number;
    periodLabel: string;
  };
  cancellationRate: {
    overallPercentage: number;
    hostPercentage: number;
    totalCancelledCount: number;
    hostCancelledCount: number;
    guestCancelledCount: number;
    excludedHostCancelledCount: number;
    periodLabel: string;
  };
  averageRating: {
    overallRating: number | null;
    totalReviewsCount: number;
    periodLabel: string;
  };
  nextUpcomingReservation: {
    id: string;
    guestName: string;
    guestImage: string | null;
    listingId: string;
    listingTitle: string;
    startDate: string;
    endDate: string;
    checkInTime: string;
    nights: number;
    guests: number;
    hostPayoutCents: number;
    isPayoutEligible: boolean;
    currency: string;
    status: string;
  } | null;
}

export interface HostDashboardData {
  hostId: string;
  hostName: string | null;
  hostEmail: string | null;
  accountStatus: UserStatus;
  isAccountInGoodStanding: boolean;
  filterListingId?: string | null;
  reservationSummary: {
    totalBookings: number;
    upcomingCount: number;
    todayCount: number;
    currentStayCount: number;
    completedCount: number;
    pendingApprovalCount: number;
    guestCancelledCount: number;
    hostCancelledCount: number;
    excludedHostCancelledCount: number;
  };
  kpis: HostDashboardKPIs;
  earnings: HostDashboardEarnings;
  reviews: HostDashboardReviews;
  messaging: {
    responseRatePercentage: number | null;
    averageResponseTimeMinutes: number | null;
    totalGuestInquiries: number;
    respondedWithin24hCount: number;
  };
  guestAnalytics: HostDashboardGuestAnalytics;
  listingPerformance: HostDashboardListingPerformance;
  listingHealth: HostDashboardListingHealth;
  superhostEvaluation: HostDashboardSuperhostEvaluation;
  guestFavoriteSummary: HostDashboardGuestFavoriteListingItem[];
  /** Deterministic, source-grounded recommendations. No external AI call is made. */
  recommendations: HostDashboardRecommendation[];
}

/**
 * Authoritative Host Dashboard aggregation service.
 * Gathers genuine stored platform data across Listings, Bookings, Reviews, Messages, and Users.
 * Supports multi-listing host aggregation and optional single-listing filtering.
 */
export async function getHostDashboardData(
  actor: AuthUser,
  opts?: { listingId?: string },
): Promise<HostDashboardData> {
  authorize(actor, [Role.HOST, Role.ADMIN]);
  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.view");
  }

  const now = new Date();
  const todayKey = bookingDateKey(now);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // 1. Host user profile and status
  const hostUser = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
    },
  });

  const accountStatus = hostUser?.status ?? UserStatus.ACTIVE;
  const isAccountInGoodStanding = accountStatus === UserStatus.ACTIVE;

  // 2. Fetch all host listings (owned or accepted co-host)
  // Dashboard aggregates must include every listing the host can access. A
  // paginated first page silently undercounted hosts with more than 100
  // properties, causing incorrect earnings, occupancy, and qualification data.
  const { items: listings } = await listingService.listForHost(actor, { take: null });
  const allListingIds = listings.map((l) => l.id);

  if (allListingIds.length === 0) {
    return createEmptyHostDashboard(actor, hostUser, isAccountInGoodStanding, opts?.listingId);
  }

  // Apply listing scope filter if provided
  let scopedListings = listings;
  let scopedListingIds = allListingIds;

  if (opts?.listingId) {
    const matching = listings.find((l) => l.id === opts.listingId);
    if (!matching) {
      throw AppError.forbidden("Listing not found or access denied for this host");
    }
    scopedListings = [matching];
    scopedListingIds = [matching.id];
  }

  // 3. Rolling 12-month window bounds for Superhost & Historical calculations
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  // Calendar Month and Year bounds for Earnings
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // 4. Fetch all bookings across scoped listings
  const allBookings = await prisma.booking.findMany({
    where: { listingId: { in: scopedListingIds } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      listing: {
        select: {
          id: true,
          title: true,
          status: true,
          published: true,
          hostId: true,
          checkInStart: true,
          checkOutTime: true,
          blockedDates: true,
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Only the six-month completed-stay analytics need residential origin. Do
  // not join private profile JSON onto every historical or future booking.
  const guestIdsNeedingOrigin = [...new Set(
    allBookings
      .filter((booking: (typeof allBookings)[number]) => (
        booking.status === BookingStatus.CONFIRMED
        && booking.endDate >= sixMonthsAgo
        && booking.endDate <= now
      ))
      .map((booking: (typeof allBookings)[number]) => booking.userId),
  )];
  const guestOriginProfiles = guestIdsNeedingOrigin.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: guestIdsNeedingOrigin } },
        select: { id: true, personalInfo: true },
      })
    : [];
  const personalInfoByGuestId = new Map(
    guestOriginProfiles.map((guest: (typeof guestOriginProfiles)[number]) => [guest.id, guest.personalInfo]),
  );

  // 5. Categorize reservations & calculate earnings
  let upcomingCount = 0;
  let todayCount = 0;
  let currentStayCount = 0;
  let completedCount = 0;
  let completedNightsCount = 0;
  let pendingApprovalCount = 0;
  let guestCancelledCount = 0;
  let hostCancelledCount = 0;
  let excludedHostCancelledCount = 0;
  let totalCancelledCount = 0;

  // Financial Earnings Accumulators (in minor units / cents)
  let monthlyEarningsCents = 0;
  let previousMonthEarningsCents = 0;
  let ytdEarningsCents = 0;
  let upcomingPayoutsCents = 0;
  let completedPayoutsCents = 0;
  let totalAccommodationSubtotalCents = 0;
  let totalCleaningFeeCents = 0;
  let totalHostServiceFeeCents = 0;
  let totalTaxesCollectedForHostCents = 0;
  let totalNetHostPayoutCents = 0;
  let totalCompletedGuestCents = 0;
  let totalExtraGuestFeeCents = 0;
  let totalPetFeeCents = 0;
  let totalRefundedCents = 0;
  let totalRefundedCount = 0;
  let bookingsWithoutPayoutSnapshotCount = 0;
  let bookingsExcludedForPaymentStatusCount = 0;
  let completedPayoutEligibleCount = 0;

  // Guest Analytics tracking
  const guestBookingCounts = new Map<string, number>();
  const guestOriginMap = new Map<string, { country: string; city: string | null; stayCount: number }>();
  let completedGuestStaysCount = 0;
  let staysWithoutRecordedOriginCount = 0;

  // Per-listing booking aggregations for Guest Favorite
  const listingBookingStats = new Map<
    string,
    { totalBookings: number; completedStays: number; hostCancellations: number; reliabilityBookings: number }
  >();
  for (const id of scopedListingIds) {
    listingBookingStats.set(id, { totalBookings: 0, completedStays: 0, hostCancellations: 0, reliabilityBookings: 0 });
  }

  for (const b of allBookings) {
    const startKey = bookingDateKey(b.startDate);
    const endKey = bookingDateKey(b.endDate);
    const nights = differenceInBookingNights(b.startDate, b.endDate);
    const payout = extractStoredHostPayout(b);

    const stats = listingBookingStats.get(b.listingId) || {
      totalBookings: 0,
      completedStays: 0,
      hostCancellations: 0,
      reliabilityBookings: 0,
    };
    stats.totalBookings++;

    if (b.status === BookingStatus.CANCELLED) {
      totalCancelledCount++;
      stats.reliabilityBookings++;
      const breakdown = b.priceBreakdown as Record<string, unknown> | null;
      const cancellation = breakdown?.cancellation as Record<string, unknown> | null;
      const cancelledBy = cancellation?.cancelledBy;

      if (cancelledBy === "HOST" && cancellation?.isExcluded !== true) {
        hostCancelledCount++;
        stats.hostCancellations++;
      } else if (cancelledBy === "HOST") {
        // Keep documented operational exclusions out of host performance and
        // qualification signals, matching the Superhost/Guest Favorite rules.
        excludedHostCancelledCount++;
      } else {
        guestCancelledCount++;
      }

      const refundAmount = extractRecordedCancellationRefund(b);
      if (refundAmount !== null && refundAmount > 0) {
        totalRefundedCents += refundAmount;
        totalRefundedCount++;
      }

      continue;
    }

    if (b.status === BookingStatus.PENDING) {
      pendingApprovalCount++;
      continue;
    }

    if (b.status === BookingStatus.CONFIRMED) {
      const payoutEligible = payout !== null && isStoredBookingPayoutEligible(b);
      if (!payoutEligible && payout !== null) {
        bookingsExcludedForPaymentStatusCount++;
      }

      // Check operational status
      const statusDetail = computeBookingStatus({
        dbStatus: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        checkInStart: b.listing.checkInStart,
        checkOutTime: b.listing.checkOutTime,
        now,
      });

      if (statusDetail.status === "COMPLETED") {
        completedCount++;
        completedNightsCount += nights;
        stats.completedStays++;
        stats.reliabilityBookings++;

        // Guest analytics intentionally use completed stays in the latest six
        // months only. This keeps origins and repeat-guest activity current,
        // while excluding pending, cancelled, and future reservations.
        if (b.endDate >= sixMonthsAgo && b.endDate <= now) {
          completedGuestStaysCount++;
          guestBookingCounts.set(b.userId, (guestBookingCounts.get(b.userId) ?? 0) + 1);

          const personalInfo = personalInfoByGuestId.get(b.userId) as Record<string, unknown> | null | undefined;
          const address = personalInfo?.residentialAddress as Record<string, unknown> | null;
          const country = typeof address?.country === "string" ? address.country.trim() : "";
          const city = typeof address?.city === "string" ? address.city.trim() : "";
          if (country) {
            const key = `${country.toLocaleLowerCase()}\u0000${city.toLocaleLowerCase()}`;
            const existingOrigin = guestOriginMap.get(key);
            if (existingOrigin) {
              existingOrigin.stayCount++;
            } else {
              guestOriginMap.set(key, { country, city: city || null, stayCount: 1 });
            }
          } else {
            staysWithoutRecordedOriginCount++;
          }
        }

        if (payout === null) {
          bookingsWithoutPayoutSnapshotCount++;
        }

        // Completed-stay earnings are paid/settled snapshot payouts only. A
        // confirmed reservation with PAYMENT_PENDING remains operationally
        // valid but cannot be presented as earned money.
        if (payoutEligible && payout) {
          completedPayoutEligibleCount++;
          completedPayoutsCents += payout.netHostPayout;
          totalAccommodationSubtotalCents += payout.accommodationSubtotal;
          totalCleaningFeeCents += payout.cleaningFee;
          totalHostServiceFeeCents += payout.hostServiceFee;
          totalTaxesCollectedForHostCents += payout.taxesCollectedForHost;
          totalNetHostPayoutCents += payout.netHostPayout;
          totalCompletedGuestCents += extractStoredGuestTotal(b) ?? 0;
          totalExtraGuestFeeCents += payout.extraGuestFee;
          totalPetFeeCents += payout.petFee;

          // Earnings use checkout date consistently for current month, prior
          // month comparison, and YTD.
          if (b.endDate >= startOfMonth && b.endDate <= endOfMonth) {
            monthlyEarningsCents += payout.netHostPayout;
          }
          if (b.endDate >= startOfPreviousMonth && b.endDate <= endOfPreviousMonth) {
            previousMonthEarningsCents += payout.netHostPayout;
          }
          if (b.endDate >= startOfYear && b.endDate <= now) {
            ytdEarningsCents += payout.netHostPayout;
          }
        }

      } else if (statusDetail.status === "CURRENT_STAY") {
        currentStayCount++;
        if (payoutEligible && payout) upcomingPayoutsCents += payout.netHostPayout;
      } else if (statusDetail.status === "CONFIRMED") {
        upcomingCount++;
        if (payoutEligible && payout) upcomingPayoutsCents += payout.netHostPayout;
      }

      if (startKey === todayKey || endKey === todayKey) {
        todayCount++;
      }
    }
  }

  // Calculate Month-over-Month earnings trend percentage
  const earningsMoMChangePercentage =
    previousMonthEarningsCents > 0
      ? Math.round(((monthlyEarningsCents - previousMonthEarningsCents) / previousMonthEarningsCents) * 100)
      : null;

  // 6. Next Upcoming Reservation
  const futureConfirmedBookings = allBookings
    .filter((b: (typeof allBookings)[number]) => b.status === BookingStatus.CONFIRMED && bookingDateKey(b.startDate) >= todayKey)
    .sort((a: (typeof allBookings)[number], b: (typeof allBookings)[number]) => a.startDate.getTime() - b.startDate.getTime());
  const futureEligiblePayoutBookings = futureConfirmedBookings.filter((b: (typeof allBookings)[number]) =>
    extractStoredHostPayout(b) !== null && isStoredBookingPayoutEligible(b),
  );

  const nextBooking = futureConfirmedBookings[0] || null;
  const nextPayout = nextBooking ? extractStoredHostPayout(nextBooking) : null;
  const nextPayoutEligible = nextBooking !== null
    && nextPayout !== null
    && isStoredBookingPayoutEligible(nextBooking);
  const nextEligiblePayoutBooking = futureEligiblePayoutBookings[0] || null;
  const nextEligiblePayout = nextEligiblePayoutBooking
    ? extractStoredHostPayout(nextEligiblePayoutBooking)
    : null;
  const nextUpcomingReservation = nextBooking
    ? {
        id: nextBooking.id,
        guestName: nextBooking.user?.name || "Guest",
        guestImage: (nextBooking.user as any)?.image || null,
        listingId: nextBooking.listingId,
        listingTitle: nextBooking.listing.title,
        startDate: bookingDateKey(nextBooking.startDate),
        endDate: bookingDateKey(nextBooking.endDate),
        checkInTime: nextBooking.listing.checkInStart || "15:00",
        nights: differenceInBookingNights(nextBooking.startDate, nextBooking.endDate),
        guests: nextBooking.guests,
        hostPayoutCents: nextPayout ? nextPayout.netHostPayout : 0,
        isPayoutEligible: nextPayoutEligible,
        currency: nextBooking.currency || "SAR",
        status: "CONFIRMED",
      }
    : null;

  // 7. Authoritative inventory calculations. Both the historical occupancy
  // card and recommendation signals reuse the same booking/blocked-date source
  // as the host calendar. Only currently active, published, unpaused listings
  // contribute bookable inventory; activation history is not stored, so past
  // availability cannot be reconstructed for listings that are no longer live.
  const inventoryListings = scopedListings.filter(
    (listing) => listing.published && listing.status === "ACTIVE" && !listing.isPaused,
  );
  const thirtyDaysAgoKey = shiftBookingDateKey(todayKey, -30);
  const occupancyInventory = calculateDashboardInventory({
    listings: inventoryListings,
    bookings: allBookings,
    startDateKey: thirtyDaysAgoKey,
    endDateKeyExclusive: todayKey,
  });
  const futureInventoryWindowDays = 14;
  const futureInventory = calculateDashboardInventory({
    listings: inventoryListings,
    bookings: allBookings,
    startDateKey: todayKey,
    endDateKeyExclusive: shiftBookingDateKey(todayKey, futureInventoryWindowDays),
  });

  // 8. Reviews & Ratings Aggregations
  const reviewScope = {
    listingId: { in: scopedListingIds },
    status: "PUBLISHED" as const,
  };
  const [reviews, recentReviews] = await Promise.all([
    prisma.review.findMany({
    where: {
      ...reviewScope,
    },
    select: {
      id: true,
      rating: true,
      cleanlinessRating: true,
      accuracyRating: true,
      checkInRating: true,
      communicationRating: true,
      locationRating: true,
      valueRating: true,
      createdAt: true,
      listingId: true,
    },
    }),
    prisma.review.findMany({
      where: reviewScope,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        author: { select: { name: true } },
        listing: { select: { title: true } },
      },
    }),
  ]);

  const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let cleanlinessSum = 0, cleanlinessCount = 0;
  let accuracySum = 0, accuracyCount = 0;
  let checkInSum = 0, checkInCount = 0;
  let communicationSum = 0, communicationCount = 0;
  let locationSum = 0, locationCount = 0;
  let valueSum = 0, valueCount = 0;

  const reviewTrendMap = new Map<string, { sum: number; count: number }>();

  const listingReviewMap = new Map<
    string,
    { count: number; sum: number; subratings: Record<string, { sum: number; count: number }> }
  >();
  for (const id of scopedListingIds) {
    listingReviewMap.set(id, {
      count: 0,
      sum: 0,
      subratings: {
        cleanliness: { sum: 0, count: 0 },
        accuracy: { sum: 0, count: 0 },
        checkIn: { sum: 0, count: 0 },
        communication: { sum: 0, count: 0 },
        location: { sum: 0, count: 0 },
        value: { sum: 0, count: 0 },
      },
    });
  }

  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    ratingDistribution[star]++;
    ratingSum += r.rating;

    if (r.cleanlinessRating) { cleanlinessSum += r.cleanlinessRating; cleanlinessCount++; }
    if (r.accuracyRating) { accuracySum += r.accuracyRating; accuracyCount++; }
    if (r.checkInRating) { checkInSum += r.checkInRating; checkInCount++; }
    if (r.communicationRating) { communicationSum += r.communicationRating; communicationCount++; }
    if (r.locationRating) { locationSum += r.locationRating; locationCount++; }
    if (r.valueRating) { valueSum += r.valueRating; valueCount++; }

    if (r.createdAt >= twelveMonthsAgo) {
      const month = `${r.createdAt.getUTCFullYear()}-${String(r.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
      const trendEntry = reviewTrendMap.get(month) ?? { sum: 0, count: 0 };
      trendEntry.sum += r.rating;
      trendEntry.count++;
      reviewTrendMap.set(month, trendEntry);
    }

    const listingReview = listingReviewMap.get(r.listingId);
    if (listingReview) {
      listingReview.count++;
      listingReview.sum += r.rating;
      if (r.cleanlinessRating) { listingReview.subratings.cleanliness.sum += r.cleanlinessRating; listingReview.subratings.cleanliness.count++; }
      if (r.accuracyRating) { listingReview.subratings.accuracy.sum += r.accuracyRating; listingReview.subratings.accuracy.count++; }
      if (r.checkInRating) { listingReview.subratings.checkIn.sum += r.checkInRating; listingReview.subratings.checkIn.count++; }
      if (r.communicationRating) { listingReview.subratings.communication.sum += r.communicationRating; listingReview.subratings.communication.count++; }
      if (r.locationRating) { listingReview.subratings.location.sum += r.locationRating; listingReview.subratings.location.count++; }
      if (r.valueRating) { listingReview.subratings.value.sum += r.valueRating; listingReview.subratings.value.count++; }
    }
  }

  const overallRating = reviews.length > 0 ? Math.round((ratingSum / reviews.length) * 100) / 100 : null;
  // Keep all twelve month buckets so the UI can represent quiet months
  // honestly rather than connecting unrelated review periods.
  const reviewTrend = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const month = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const value = reviewTrendMap.get(month);
    return {
      month,
      averageRating: value && value.count > 0 ? Math.round((value.sum / value.count) * 100) / 100 : null,
      reviewCount: value?.count ?? 0,
    };
  });

  // 9. The Superhost service is the single owner-level source for the rolling
  // 12-month messaging metric and live qualification progress. This remains
  // intentionally independent from an optional single-listing dashboard filter.
  const superhostStatus = await getLiveSuperhostStatus(actor.id, now);
  const messagingMetrics = superhostStatus;

  // 10. Superhost progress comes only from the authoritative owner-level service.
  const meetsReservationOrNightsThreshold = superhostStatus.hostingVolume.met;
  const meetsRatingThreshold = superhostStatus.ratingMet;
  const meetsResponseRateThreshold = superhostStatus.responseRateMet;
  const hostCancellationRatePercentage = superhostStatus.hostCancellationRatePercentage;
  const meetsCancellationThreshold = superhostStatus.cancellationMet;
  const gaps = superhostStatus.failureReasons;
  const isSuperhostQualified = superhostStatus.eligibleNow;

  // 11. Guest Analytics
  const uniqueGuestsCount = guestBookingCounts.size;
  let returningGuestsCount = 0;
  for (const count of guestBookingCounts.values()) {
    if (count >= 2) returningGuestsCount++;
  }
  const returningGuestsPercentage =
    uniqueGuestsCount > 0 ? Math.round((returningGuestsCount / uniqueGuestsCount) * 100) : 0;

  const guestOrigins = Array.from(guestOriginMap.values())
    .map((origin) => ({
      ...origin,
      sharePercentage: completedGuestStaysCount > 0
        ? Math.round((origin.stayCount / completedGuestStaysCount) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.stayCount - a.stayCount || a.country.localeCompare(b.country));
  const guestOriginCountryMap = new Map<string, number>();
  for (const origin of guestOrigins) {
    guestOriginCountryMap.set(
      origin.country,
      (guestOriginCountryMap.get(origin.country) ?? 0) + origin.stayCount,
    );
  }
  const guestOriginCountries = Array.from(guestOriginCountryMap.entries())
    .map(([country, guestCount]) => ({
      country,
      guestCount,
      sharePercentage: completedGuestStaysCount > 0
        ? Math.round((guestCount / completedGuestStaysCount) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.guestCount - a.guestCount || a.country.localeCompare(b.country));

  // 12. Listing Performance Counts
  const activeListings = scopedListings.filter((l) => l.published && l.status === "ACTIVE" && !l.isPaused).length;
  const draftListings = scopedListings.filter((l) => l.status === "DRAFT" || l.status === "IN_PROGRESS").length;
  const pausedListings = scopedListings.filter((l) => Boolean(l.isPaused)).length;

  const listingHealth: HostDashboardListingHealth = {
    responseRatePercentage: messagingMetrics.responseRatePercentage,
    averageResponseTimeMinutes: messagingMetrics.averageResponseTimeMinutes,
    totalGuestInquiries: messagingMetrics.totalGuestInquiries,
    listings: scopedListings.map((listing) => {
      const checks = [
        { label: "a title", complete: Boolean(listing.title.trim()) },
        { label: "a description", complete: Boolean(listing.description.trim()) },
        { label: "at least one photo", complete: listing.photos.length > 0 },
        { label: "a city and country", complete: Boolean(listing.city?.trim() && listing.country?.trim()) },
        { label: "at least one amenity", complete: listing.amenities.length > 0 },
        { label: "guest capacity", complete: listing.guests > 0 },
        { label: "bed information", complete: listing.beds > 0 },
        { label: "a nightly price", complete: (listing.weekdayBasePrice ?? listing.price) > 0 },
        { label: "valid stay-length limits", complete: listing.minNights > 0 && listing.maxNights >= listing.minNights },
        { label: "check-in instructions", complete: Boolean(listing.checkInInstructions?.trim()) },
      ];
      const missingFields = checks.filter((check) => !check.complete).map((check) => check.label);
      return {
        listingId: listing.id,
        title: listing.title,
        status: listing.status,
        published: Boolean(listing.published),
        isPaused: Boolean(listing.isPaused),
        photoCount: listing.photos.length,
        amenityCount: listing.amenities.length,
        completedChecks: checks.length - missingFields.length,
        totalChecks: checks.length,
        missingFields,
      };
    }),
  };

  // 13. Cancellation Rates
  const totalBookingsCount = allBookings.length;
  const overallCancellationRatePercentage =
    totalBookingsCount > 0
      ? Math.round((totalCancelledCount / totalBookingsCount) * 1000) / 10
      : 0;

  const totalConfirmedOrCompleted = completedCount + upcomingCount + currentStayCount + hostCancelledCount;
  const hostRate =
    totalConfirmedOrCompleted > 0
      ? Math.round((hostCancelledCount / totalConfirmedOrCompleted) * 1000) / 10
      : 0;

  // 14. Average Booking Value & Stay Length
  const averageBookingValue = {
    hostPayoutCents: completedPayoutEligibleCount > 0 ? Math.round(completedPayoutsCents / completedPayoutEligibleCount) : 0,
    guestTotalCents: completedPayoutEligibleCount > 0 ? Math.round(totalCompletedGuestCents / completedPayoutEligibleCount) : 0,
    currency: "SAR",
    completedBookingsCount: completedPayoutEligibleCount,
    periodLabel: "Eligible Completed Stays",
  };

  const averageStayLength = {
    nights: completedCount > 0 ? Math.round((completedNightsCount / completedCount) * 10) / 10 : 0,
    completedStaysCount: completedCount,
    periodLabel: "Completed Stays",
  };

  const recommendations = buildHostDashboardRecommendations({
    hostCancellationRatePercentage: hostRate,
    responseRatePercentage: messagingMetrics.responseRatePercentage,
    overallRating,
    totalReviewsCount: reviews.length,
    futureAvailableNights: futureInventory.availableNights,
    futureWindowDays: futureInventoryWindowDays,
    listings: listingHealth.listings.map((listing) => ({
      id: listing.listingId,
      title: listing.title,
      missingFields: listing.missingFields,
    })),
  });

  // 15. Guest Favorite Per-Listing Summary
  const guestFavoriteSummary: HostDashboardGuestFavoriteListingItem[] = scopedListings.map((l) => {
    const bStats = listingBookingStats.get(l.id) || { totalBookings: 0, completedStays: 0, hostCancellations: 0, reliabilityBookings: 0 };
    const rStats = listingReviewMap.get(l.id) || { count: 0, sum: 0, subratings: {} as any };

    const listingRating = rStats.count > 0 ? Math.round((rStats.sum / rStats.count) * 100) / 100 : null;
    const sub = (key: string) => {
      const entry = (rStats.subratings as any)?.[key];
      return entry && entry.count > 0 ? Math.round((entry.sum / entry.count) * 10) / 10 : null;
    };
    const categoryRatings = {
      cleanliness: { average: sub("cleanliness"), reviewCount: rStats.subratings.cleanliness.count },
      accuracy: { average: sub("accuracy"), reviewCount: rStats.subratings.accuracy.count },
      checkIn: { average: sub("checkIn"), reviewCount: rStats.subratings.checkIn.count },
      communication: { average: sub("communication"), reviewCount: rStats.subratings.communication.count },
      location: { average: sub("location"), reviewCount: rStats.subratings.location.count },
      value: { average: sub("value"), reviewCount: rStats.subratings.value.count },
    };
    const guestFavoriteProgress = evaluateGuestFavoriteRequirements({
      publishedReviewCount: rStats.count,
      overallRating: listingRating,
      categoryRatings,
      totalBookings: bStats.reliabilityBookings,
      hostCancellationCount: bStats.hostCancellations,
    });

    return {
      listingId: l.id,
      title: l.title,
      status: l.status,
      published: Boolean(l.published),
      officialStatus: Boolean(l.isGuestFavorite),
      guestFavoriteSince: l.guestFavoriteSince ? new Date(l.guestFavoriteSince).toISOString() : null,
      lastEvaluatedAt: l.guestFavoriteLastEvaluatedAt ? new Date(l.guestFavoriteLastEvaluatedAt).toISOString() : null,
      totalBookings: bStats.totalBookings,
      completedStays: bStats.completedStays,
      reviewsCount: rStats.count,
      overallRating: listingRating,
      categoryRatings: {
        cleanliness: sub("cleanliness"),
        accuracy: sub("accuracy"),
        checkIn: sub("checkIn"),
        communication: sub("communication"),
        location: sub("location"),
        value: sub("value"),
      },
      hostCancellations: bStats.hostCancellations,
      reliabilityFailureRatePercentage: guestFavoriteProgress.reliabilityFailureRatePercentage,
      minimumReviewsMet: guestFavoriteProgress.minimumReviewsMet,
      overallRatingMet: guestFavoriteProgress.overallRatingMet,
      subratingCoverageMet: guestFavoriteProgress.subratingCoverageMet,
      subratingConsistencyMet: guestFavoriteProgress.subratingConsistencyMet,
      reliabilityMet: guestFavoriteProgress.reliabilityMet,
      qualityIssuesReported: {
        status: "DATA_UNAVAILABLE",
        message: "Property-level support/quality incident tracking is not currently instrumented.",
      },
      eligibleNow: guestFavoriteProgress.eligibleNow,
    };
  });

  // Construct structured main KPIs object
  const kpis: HostDashboardKPIs = {
    periodLabel: "Last 30 Days",
    monthlyEarnings: {
      amountCents: monthlyEarningsCents,
      currency: "SAR",
      periodLabel: "Current Month",
      previousMonthAmountCents: previousMonthEarningsCents,
      changePercentage: earningsMoMChangePercentage,
    },
    ytdEarnings: {
      amountCents: ytdEarningsCents,
      currency: "SAR",
      periodLabel: "Current Year",
    },
    upcomingPayout: {
      totalUpcomingAmountCents: upcomingPayoutsCents,
      currency: "SAR",
      nextPayoutAmountCents: nextEligiblePayout ? nextEligiblePayout.netHostPayout : null,
      nextEligibleStayStartDate: nextEligiblePayoutBooking ? bookingDateKey(nextEligiblePayoutBooking.startDate) : null,
      nextPayoutListingTitle: nextEligiblePayoutBooking ? nextEligiblePayoutBooking.listing.title : null,
      nextPayoutGuestName: nextEligiblePayoutBooking ? nextEligiblePayoutBooking.user?.name || "Guest" : null,
      count: futureEligiblePayoutBookings.length,
      excludedForPaymentStatusCount: futureConfirmedBookings.length - futureEligiblePayoutBookings.length,
      periodLabel: "Eligible Upcoming Stays (not a payout schedule)",
    },
    occupancy: {
      ratePercentage: occupancyInventory.ratePercentage,
      bookedNights: occupancyInventory.bookedNights,
      availableNights: occupancyInventory.availableNights,
      totalBookableNights: occupancyInventory.bookableNights,
      blockedNights: occupancyInventory.blockedNights,
      periodLabel: "Last 30 Days",
    },
    averageBookingValue,
    averageStayLength,
    cancellationRate: {
      overallPercentage: overallCancellationRatePercentage,
      hostPercentage: hostRate,
      totalCancelledCount,
      hostCancelledCount,
      guestCancelledCount,
      excludedHostCancelledCount,
      periodLabel: "All Time",
    },
    averageRating: {
      overallRating,
      totalReviewsCount: reviews.length,
      periodLabel: "All Time",
    },
    nextUpcomingReservation,
  };

  return {
    hostId: actor.id,
    hostName: hostUser?.name || null,
    hostEmail: hostUser?.email || null,
    accountStatus,
    isAccountInGoodStanding,
    filterListingId: opts?.listingId || null,
    reservationSummary: {
      totalBookings: allBookings.length,
      upcomingCount,
      todayCount,
      currentStayCount,
      completedCount,
      pendingApprovalCount,
      guestCancelledCount,
      hostCancelledCount,
      excludedHostCancelledCount,
    },
    kpis,
    earnings: {
      monthlyEarningsCents,
      ytdEarningsCents,
      upcomingPayoutsCents,
      completedPayoutsCents,
      currency: "SAR",
      refunds: {
        amountCents: totalRefundedCents,
        count: totalRefundedCount,
        periodLabel: "All recorded cancellations" as const,
        source: "BOOKING_CANCELLATION_SNAPSHOT" as const,
      },
      adjustments: {
        status: "DATA_UNAVAILABLE" as const,
        message: "Payout and booking adjustments are not currently stored in a financial ledger." as const,
      },
      bookingsWithoutPayoutSnapshotCount,
      bookingsExcludedForPaymentStatusCount,
      itemizedBreakdown: {
        accommodationSubtotalCents: totalAccommodationSubtotalCents,
        extraGuestFeeCents: totalExtraGuestFeeCents,
        petFeeCents: totalPetFeeCents,
        cleaningFeeCents: totalCleaningFeeCents,
        hostServiceFeeCents: totalHostServiceFeeCents,
        taxesCollectedForHostCents: totalTaxesCollectedForHostCents,
        netHostPayoutCents: totalNetHostPayoutCents,
      },
    },
    reviews: {
      overallRating,
      totalReviewsCount: reviews.length,
      ratingDistribution,
      categoryRatings: {
        cleanliness: cleanlinessCount > 0 ? Math.round((cleanlinessSum / cleanlinessCount) * 10) / 10 : null,
        accuracy: accuracyCount > 0 ? Math.round((accuracySum / accuracyCount) * 10) / 10 : null,
        checkIn: checkInCount > 0 ? Math.round((checkInSum / checkInCount) * 10) / 10 : null,
        communication: communicationCount > 0 ? Math.round((communicationSum / communicationCount) * 10) / 10 : null,
        location: locationCount > 0 ? Math.round((locationSum / locationCount) * 10) / 10 : null,
        value: valueCount > 0 ? Math.round((valueSum / valueCount) * 10) / 10 : null,
      },
      trend: reviewTrend,
      recentReviews: recentReviews.map((review: (typeof recentReviews)[number]) => ({
        id: review.id,
        guestName: review.author.name || "Guest",
        listingTitle: review.listing.title,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      })),
    },
    messaging: {
      responseRatePercentage: messagingMetrics.responseRatePercentage,
      averageResponseTimeMinutes: messagingMetrics.averageResponseTimeMinutes,
      totalGuestInquiries: messagingMetrics.totalGuestInquiries,
      respondedWithin24hCount: messagingMetrics.respondedWithin24hCount,
    },
    guestAnalytics: {
      uniqueGuestsCount,
      completedGuestStaysCount,
      returningGuestsCount,
      returningGuestsPercentage,
      guestOriginCountries,
      guestOrigins,
      staysWithoutRecordedOriginCount,
      checkInInstructionsViewed: {
        status: "DATA_UNAVAILABLE",
        message: "Check-in instructions viewed tracking is not currently instrumented in the event database.",
      },
    },
    listingPerformance: {
      totalListings: scopedListings.length,
      activeListings,
      draftListings,
      pausedListings,
      pageViews: {
        status: "DATA_UNAVAILABLE",
        message: "Individual listing impression and page view logging is not currently instrumented in database.",
      },
      conversionRate: {
        status: "DATA_UNAVAILABLE",
        message: "Search-to-booking funnel conversion event tracking is not currently instrumented in database.",
      },
    },
    listingHealth,
    superhostEvaluation: {
      officialStatus: superhostStatus.officialStatus,
      lastEvaluatedAt: superhostStatus.lastEvaluatedAt?.toISOString() ?? null,
      nextEvaluationAt: superhostStatus.nextEvaluationAt.toISOString(),
      currentProgress: {
        completedReservationsCount: superhostStatus.completedReservationsCount,
        completedNightsCount: superhostStatus.completedNightsCount,
        reservationPathMet: superhostStatus.hostingVolume.reservationPathMet,
        longStayPathMet: superhostStatus.hostingVolume.longStayPathMet,
        hostingVolumeMet: superhostStatus.hostingVolume.met,
        overallRating: superhostStatus.overallRating,
        publishedReviewCount: superhostStatus.publishedReviewCount,
        ratingMet: superhostStatus.ratingMet,
        responseRatePercentage: superhostStatus.responseRatePercentage,
        responseRateMet: superhostStatus.responseRateMet,
        hostCancellationRatePercentage: superhostStatus.hostCancellationRatePercentage,
        hostCancellationCount: superhostStatus.hostCancellationCount,
        cancellationDenominator: superhostStatus.cancellationDenominator,
        cancellationMet: superhostStatus.cancellationMet,
        accountGoodStanding: superhostStatus.accountGoodStanding,
        accountStandingMet: superhostStatus.accountStandingMet,
        eligibleNow: superhostStatus.eligibleNow,
      },
      isQualified: isSuperhostQualified,
      evaluatedWindowMonths: 12,
      windowStart: twelveMonthsAgo.toISOString(),
      windowEnd: now.toISOString(),
      metrics: {
        completedReservationsCount: superhostStatus.completedReservationsCount,
        requiredReservationsCount: 10,
        completedNightsCount: superhostStatus.completedNightsCount,
        meetsReservationOrNightsThreshold,
        overallRating: superhostStatus.overallRating,
        requiredRating: 4.8,
        meetsRatingThreshold,
        responseRatePercentage: messagingMetrics.responseRatePercentage,
        requiredResponseRatePercentage: 90,
        meetsResponseRateThreshold,
        hostCancellationRatePercentage: superhostStatus.hostCancellationRatePercentage,
        maxPermittedCancellationRatePercentage: 1.0,
        meetsCancellationThreshold,
        accountGoodStanding: superhostStatus.accountGoodStanding,
        activeListingCount: activeListings,
      },
      gaps,
    },
    guestFavoriteSummary,
    recommendations,
  };
}

type DashboardInventoryListing = {
  id: string;
  blockedDates: string[];
};

type DashboardInventoryBooking = {
  listingId: string;
  status: BookingStatus;
  startDate: Date;
  endDate: Date;
};

/**
 * A dashboard adapter over the shared booking-calendar data. It stores no
 * availability state: confirmed reservation nights take precedence over manual
 * blocks, and remaining active inventory is available.
 */
function calculateDashboardInventory({
  listings,
  bookings,
  startDateKey,
  endDateKeyExclusive,
}: {
  listings: DashboardInventoryListing[];
  bookings: DashboardInventoryBooking[];
  startDateKey: string;
  endDateKeyExclusive: string;
}) {
  const dateKeys: string[] = [];
  for (
    let cursor = parseBookingDate(startDateKey);
    bookingDateKey(cursor) < endDateKeyExclusive;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dateKeys.push(bookingDateKey(cursor));
  }

  const listingIds = new Set(listings.map((listing) => listing.id));
  const booked = new Set<string>();
  const blocked = new Set<string>();
  for (const listing of listings) {
    for (const dateKey of listing.blockedDates || []) {
      if (dateKey >= startDateKey && dateKey < endDateKeyExclusive) {
        blocked.add(`${listing.id}_${dateKey}`);
      }
    }
  }
  for (const booking of bookings) {
    if (booking.status !== BookingStatus.CONFIRMED || !listingIds.has(booking.listingId)) continue;
    for (
      let cursor = parseBookingDate(booking.startDate);
      bookingDateKey(cursor) < bookingDateKey(booking.endDate);
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const dateKey = bookingDateKey(cursor);
      if (dateKey >= startDateKey && dateKey < endDateKeyExclusive) {
        booked.add(`${booking.listingId}_${dateKey}`);
      }
    }
  }

  const totalCalendarNights = listings.length * dateKeys.length;
  let blockedNights = 0;
  let bookedNights = 0;
  for (const listing of listings) {
    for (const dateKey of dateKeys) {
      const key = `${listing.id}_${dateKey}`;
      if (booked.has(key)) bookedNights++;
      else if (blocked.has(key)) blockedNights++;
    }
  }
  const bookableNights = Math.max(0, totalCalendarNights - blockedNights);
  const availableNights = Math.max(0, bookableNights - bookedNights);
  return {
    blockedNights,
    bookedNights,
    bookableNights,
    availableNights,
    ratePercentage: bookableNights > 0
      ? Math.min(100, Math.round((bookedNights / bookableNights) * 1000) / 10)
      : 0,
  };
}

function createEmptyHostDashboard(
  actor: AuthUser,
  hostUser: { id: string; name: string | null; email: string | null; status: UserStatus } | null,
  isAccountInGoodStanding: boolean,
  filterListingId?: string | null,
): HostDashboardData {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  return {
    hostId: actor.id,
    hostName: hostUser?.name || null,
    hostEmail: hostUser?.email || null,
    accountStatus: hostUser?.status ?? UserStatus.ACTIVE,
    isAccountInGoodStanding,
    filterListingId: filterListingId || null,
    reservationSummary: {
      totalBookings: 0,
      upcomingCount: 0,
      todayCount: 0,
      currentStayCount: 0,
      completedCount: 0,
      pendingApprovalCount: 0,
      guestCancelledCount: 0,
      hostCancelledCount: 0,
      excludedHostCancelledCount: 0,
    },
    kpis: {
      periodLabel: "Last 30 Days",
      monthlyEarnings: {
        amountCents: 0,
        currency: "SAR",
        periodLabel: "Current Month",
        previousMonthAmountCents: 0,
        changePercentage: null,
      },
      ytdEarnings: {
        amountCents: 0,
        currency: "SAR",
        periodLabel: "Current Year",
      },
      upcomingPayout: {
        totalUpcomingAmountCents: 0,
        currency: "SAR",
        nextPayoutAmountCents: null,
        nextEligibleStayStartDate: null,
        nextPayoutListingTitle: null,
        nextPayoutGuestName: null,
        count: 0,
        excludedForPaymentStatusCount: 0,
        periodLabel: "Eligible Upcoming Stays (not a payout schedule)",
      },
      occupancy: {
        ratePercentage: 0,
        bookedNights: 0,
        availableNights: 0,
        totalBookableNights: 0,
        blockedNights: 0,
        periodLabel: "Last 30 Days",
      },
      averageBookingValue: {
        hostPayoutCents: 0,
        guestTotalCents: 0,
        currency: "SAR",
        completedBookingsCount: 0,
        periodLabel: "Completed Stays",
      },
      averageStayLength: {
        nights: 0,
        completedStaysCount: 0,
        periodLabel: "Completed Stays",
      },
      cancellationRate: {
        overallPercentage: 0,
        hostPercentage: 0,
        totalCancelledCount: 0,
        hostCancelledCount: 0,
        guestCancelledCount: 0,
        excludedHostCancelledCount: 0,
        periodLabel: "All Time",
      },
      averageRating: {
        overallRating: null,
        totalReviewsCount: 0,
        periodLabel: "All Time",
      },
      nextUpcomingReservation: null,
    },
    earnings: {
      monthlyEarningsCents: 0,
      ytdEarningsCents: 0,
      upcomingPayoutsCents: 0,
      completedPayoutsCents: 0,
      currency: "SAR",
      refunds: {
        amountCents: 0,
        count: 0,
        periodLabel: "All recorded cancellations" as const,
        source: "BOOKING_CANCELLATION_SNAPSHOT" as const,
      },
      adjustments: {
        status: "DATA_UNAVAILABLE" as const,
        message: "Payout and booking adjustments are not currently stored in a financial ledger." as const,
      },
      bookingsWithoutPayoutSnapshotCount: 0,
      bookingsExcludedForPaymentStatusCount: 0,
      itemizedBreakdown: {
        accommodationSubtotalCents: 0,
        extraGuestFeeCents: 0,
        petFeeCents: 0,
        cleaningFeeCents: 0,
        hostServiceFeeCents: 0,
        taxesCollectedForHostCents: 0,
        netHostPayoutCents: 0,
      },
    },
    reviews: {
      overallRating: null,
      totalReviewsCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryRatings: {
        cleanliness: null,
        accuracy: null,
        checkIn: null,
        communication: null,
        location: null,
        value: null,
      },
      trend: [],
      recentReviews: [],
    },
    messaging: {
      responseRatePercentage: null,
      averageResponseTimeMinutes: null,
      totalGuestInquiries: 0,
      respondedWithin24hCount: 0,
    },
    guestAnalytics: {
      uniqueGuestsCount: 0,
      completedGuestStaysCount: 0,
      returningGuestsCount: 0,
      returningGuestsPercentage: 0,
      guestOriginCountries: [],
      guestOrigins: [],
      staysWithoutRecordedOriginCount: 0,
      checkInInstructionsViewed: {
        status: "DATA_UNAVAILABLE",
        message: "Check-in instructions viewed tracking is not currently instrumented in the event database.",
      },
    },
    listingPerformance: {
      totalListings: 0,
      activeListings: 0,
      draftListings: 0,
      pausedListings: 0,
      pageViews: {
        status: "DATA_UNAVAILABLE",
        message: "Individual listing impression and page view logging is not currently instrumented in database.",
      },
      conversionRate: {
        status: "DATA_UNAVAILABLE",
        message: "Search-to-booking funnel conversion event tracking is not currently instrumented in database.",
      },
    },
    listingHealth: {
      responseRatePercentage: null,
      averageResponseTimeMinutes: null,
      totalGuestInquiries: 0,
      listings: [],
    },
    superhostEvaluation: {
      officialStatus: false,
      lastEvaluatedAt: null,
      nextEvaluationAt: getNextQuarterlyEvaluationDate(now).toISOString(),
      currentProgress: {
        completedReservationsCount: 0,
        completedNightsCount: 0,
        reservationPathMet: false,
        longStayPathMet: false,
        hostingVolumeMet: false,
        overallRating: null,
        publishedReviewCount: 0,
        ratingMet: false,
        responseRatePercentage: null,
        responseRateMet: false,
        hostCancellationRatePercentage: 0,
        hostCancellationCount: 0,
        cancellationDenominator: 0,
        cancellationMet: true,
        accountGoodStanding: isAccountInGoodStanding,
        accountStandingMet: isAccountInGoodStanding,
        eligibleNow: false,
      },
      isQualified: false,
      evaluatedWindowMonths: 12,
      windowStart: twelveMonthsAgo.toISOString(),
      windowEnd: now.toISOString(),
      metrics: {
        completedReservationsCount: 0,
        requiredReservationsCount: 10,
        completedNightsCount: 0,
        meetsReservationOrNightsThreshold: false,
        overallRating: null,
        requiredRating: 4.8,
        meetsRatingThreshold: false,
        responseRatePercentage: null,
        requiredResponseRatePercentage: 90,
        meetsResponseRateThreshold: false,
        hostCancellationRatePercentage: 0,
        maxPermittedCancellationRatePercentage: 1.0,
        meetsCancellationThreshold: true,
        accountGoodStanding: isAccountInGoodStanding,
        activeListingCount: 0,
      },
      gaps: [
        "Need 10 completed stays (or 100 nights) in the last 12 months.",
        "Requires at least one review with rating 4.80 or higher.",
        "Response rate is unavailable until the first guest inquiry is received.",
      ],
    },
    guestFavoriteSummary: [],
    recommendations: [],
  };
}
