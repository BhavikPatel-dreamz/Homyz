import "server-only";

import { prisma } from "@/lib/db/prisma";
import { BookingStatus, ReviewDirection, Role, UserStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { authorize } from "@/lib/permissions/authorize";
import { assertHostPermission } from "@/lib/permissions/host-permissions-server";
import { listingService } from "@/services/listing.service";
import { getLiveSuperhostStatus, getNextQuarterlyEvaluationDate } from "@/services/superhost.service";
import { messagingService } from "@/services/messaging.service";
import { evaluateGuestFavoriteRequirements } from "@/lib/guest-favorite/rules";
import { bookingDateKey, differenceInBookingNights, shiftBookingDateKey } from "@/lib/booking/booking-date";
import {
  calculateDashboardInventory as calculateSharedDashboardInventory,
  calculateDashboardInventoryByDate as calculateSharedDashboardInventoryByDate,
  type DashboardInventoryBooking,
  type DashboardInventoryDatePoint,
  type DashboardInventoryListing,
} from "@/lib/dashboard/host-inventory";
export type { DashboardInventoryBooking, DashboardInventoryDatePoint, DashboardInventoryListing } from "@/lib/dashboard/host-inventory";
import { computeBookingStatus } from "@/lib/booking/booking-status";
import {
  extractRecordedCancellationRefund,
  extractStoredGuestTotal,
  extractStoredHostPayout,
} from "@/lib/booking/booking-financials";
import {
  calculateBookingPayout,
  type BookingPayoutCalculation,
  type HostPayoutMethod,
} from "@/services/payout.service";
import { AppError } from "@/lib/api/errors";
import {
  buildHostDashboardRecommendations,
  type HostDashboardRecommendation,
} from "@/lib/dashboard/host-recommendations";
import {
  resolvePropertyCurrency,
  normalizeCurrencyCode,
  DEFAULT_CURRENCY,
} from "@/lib/currency";
import {
  resolveReportingPeriod,
  type DateRangePreset,
  type ResolvedReportingPeriod,
} from "@/lib/dashboard/reporting-filter";
import { getListingAnalyticsSummary } from "@/services/listing-analytics.service";
import {
  getHostDashboardEntitlements,
  resolveHostDashboardEntitlements,
  type HostDashboardEntitlements,
} from "@/lib/entitlements/host-dashboard";

type JsonRecord = Record<string, unknown>;

function asJsonRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getCheckInTrackingStartDate() {
  const value = process.env.CHECKIN_INSTRUCTIONS_TRACKING_STARTED_AT;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface HostDashboardCurrencyBreakdownItem {
  currency: string;
  monthlyEarningsCents: number;
  ytdEarningsCents: number;
  upcomingPayoutsCents: number;
  completedPayoutsCents: number;
  grossVolumeCents: number;
  netPayoutCents: number;
  bookingCount: number;
}

export interface HostDashboardEarnings {
  monthlyEarningsCents: number;
  ytdEarningsCents: number;
  upcomingPayoutsCents: number;
  completedPayoutsCents: number;
  grossEarningsCents: number;
  deductionsCents: number;
  netEarningsCents: number;
  currency: string;
  hasMixedCurrencies: boolean;
  currencyBreakdown: HostDashboardCurrencyBreakdownItem[];
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

export interface HostDashboardThisMonthSnapshot {
  periodLabel: string;
  bookingsCount: number;
  previousMonthBookingsCount: number;
  bookingsChangePercentage: number | null;
  cancellationsCount: number;
  cancellationRatePercentage: number;
  averageStayNights: number;
  previousMonthAverageStayNights: number;
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
  guestOrigins: Array<{ country: string; city: string | null; guestCount: number; sharePercentage: number }>;
  staysWithoutRecordedOriginCount: number;
  checkInInstructionsViewed: {
    status: "ACTIVE" | "DATA_UNAVAILABLE";
    message: string;
    viewedCount: number;
    notViewedCount: number;
    eligibleReservationsCount: number;
    trackingStartedAt: string | null;
  };
}

export interface HostDashboardSuperhostEvaluation {
  officialStatus: boolean;
  lastEvaluatedAt: string | null;
  nextEvaluationAt: string;
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
    qualification: {
      eligibilityStatus: "ELIGIBLE" | "NOT_ELIGIBLE" | "CANNOT_DETERMINE";
      criteria: Array<{
        id: string;
        actualValue: boolean | number | string | null | Record<string, number | boolean>;
        requiredThreshold: string;
        status: "PASS" | "FAIL" | "BLOCKED";
        explanation: string;
      }>;
      missingInformation: string[];
      unresolvedPolicyDependencies: string[];
    };
    eligibleNow: boolean;
  };
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
    status: "ACTIVE" | "DATA_UNAVAILABLE";
    message: string;
    count: number;
    trackingStartedAt: string | null;
  };
  conversionRate: {
    status: "ACTIVE" | "DATA_UNAVAILABLE";
    message: string;
    percentage: number | null;
    attributedConfirmedBookings: number;
    searchImpressions: number;
    trackingStartedAt: string | null;
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
    nextPayoutStatus?: string | null;
    nextPayoutExpectedArrival?: string | null;
    nextPayoutMethodMasked?: string | null;
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
  upcomingReservations?: Array<{
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
  }>;
}

export interface HostDashboardData {
  hostId: string;
  hostName: string | null;
  hostEmail: string | null;
  accountStatus: UserStatus;
  isAccountInGoodStanding: boolean;
  filterListingId?: string | null;
  /** Listings accessible within the current dashboard scope. */
  listings: Array<{ id: string; title: string }>;
  /** Financial figures are always native to this selected currency. */
  filterCurrency: string;
  availableCurrencies: string[];
  reportingPeriod: {
    preset: DateRangePreset;
    label: string;
    startDateKey: string;
    endDateKey: string;
    comparisonStartDateKey: string;
    comparisonEndDateKey: string;
    comparisonLabel: string;
  };
  thisMonthSnapshot: HostDashboardThisMonthSnapshot;
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
  reportingActivity: {
    confirmedBookingsCount: number;
    completedStaysCount: number;
    completedNightsCount: number;
    cancelledBookingsCount: number;
  };
  kpis: HostDashboardKPIs;
  earnings: HostDashboardEarnings;
  reviews: HostDashboardReviews;
  messaging: {
    responseRatePercentage: number | null;
    averageResponseTimeMinutes: number | null;
    totalGuestInquiries: number;
    respondedCount: number;
    respondedWithin24hCount: number;
  };
  guestAnalytics: HostDashboardGuestAnalytics;
  listingPerformance: HostDashboardListingPerformance;
  listingHealth: HostDashboardListingHealth;
  superhostEvaluation: HostDashboardSuperhostEvaluation;
  guestFavoriteSummary: HostDashboardGuestFavoriteListingItem[];
  recommendations: HostDashboardRecommendation[];
  entitlements: HostDashboardEntitlements;
}

export interface HostDashboardFilterOptions {
  listingId?: string;
  period?: DateRangePreset | string;
  startDate?: string;
  endDate?: string;
  currency?: string;
  actorRole?: Role;
}

// Bounded in-memory TTL caching to optimize performance for hosts with large histories
const dashboardCache = new Map<string, { data: HostDashboardData; expiresAt: number }>();
const CACHE_TTL_MS = 20_000; // 20 seconds TTL

export function clearHostDashboardCache(hostId?: string) {
  if (hostId) {
    for (const key of dashboardCache.keys()) {
      if (key.startsWith(`${hostId}:`)) dashboardCache.delete(key);
    }
  } else {
    dashboardCache.clear();
  }
}

/**
 * Authoritative Host Dashboard aggregation service.
 * Gathers genuine stored platform data across Listings, Bookings, Reviews, Messages, and Users.
 * Supports multi-listing host aggregation and optional single-listing filtering.
 */
export async function getHostDashboardData(
  actor: AuthUser,
  opts?: HostDashboardFilterOptions,
): Promise<HostDashboardData> {
  authorize(actor, [Role.HOST, Role.ADMIN]);
  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.view");
  }

  const cacheKey = `${actor.id}:${opts?.listingId ?? "all"}:${opts?.period ?? "this_month"}:${opts?.startDate ?? ""}:${opts?.endDate ?? ""}:${opts?.currency ?? ""}`;
  const cached = dashboardCache.get(cacheKey);
  const nowMs = Date.now();
  // Reject cache entries created by earlier dashboard DTO versions during a
  // hot-reload/deployment, rather than returning an incomplete payload.
  if (cached && cached.expiresAt > nowMs && Array.isArray(cached.data.listings)) {
    return cached.data;
  }
  if (cached) dashboardCache.delete(cacheKey);

  const now = new Date();
  const todayKey = bookingDateKey(now);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Derive unified reporting period
  const reportingPeriod = resolveReportingPeriod(
    {
      period: opts?.period as DateRangePreset,
      startDate: opts?.startDate,
      endDate: opts?.endDate,
    },
    now,
  );

  // The profile and authorized listing lookup do not depend on one another.
  // Start them together so dashboard latency is governed by the slower query,
  // rather than the sum of both queries.
  const [hostUser, hostListings, entitlements] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        personalInfo: true,
        createdAt: true,
      },
    }),
    listingService.listForHost(actor, { take: null }),
    getHostDashboardEntitlements(actor),
  ]);

  const accountStatus = hostUser?.status ?? UserStatus.ACTIVE;
  const isAccountInGoodStanding = accountStatus === UserStatus.ACTIVE;
  const hostInfo = asJsonRecord(hostUser?.personalInfo) ?? {};
  const hostPayoutMethods = Array.isArray(hostInfo.payoutMethods)
    ? hostInfo.payoutMethods.map(asJsonRecord).filter((method): method is JsonRecord => method !== null)
    : [];
  const typedHostPayoutMethods = hostPayoutMethods as unknown as HostPayoutMethod[];
  const defaultPayoutMethod = hostPayoutMethods.find((method) => method.isDefault === true) ?? hostPayoutMethods[0] ?? null;
  const defaultPayoutCurrency = readNonEmptyString(defaultPayoutMethod?.currency) ?? DEFAULT_CURRENCY;
  const maskedPayoutMethod = defaultPayoutMethod
    ? `${readNonEmptyString(defaultPayoutMethod.bankName) ?? "Bank account"} ••••${readNonEmptyString(defaultPayoutMethod.ibanLast4) ?? readNonEmptyString(defaultPayoutMethod.ibanMasked)?.slice(-4) ?? "••••"}`
    : null;

  // 2. Use the owned or accepted co-host listings fetched above.
  const { items: listings } = hostListings;
  const allListingIds = listings.map((l) => l.id);

  if (allListingIds.length === 0) {
    const emptyData = createEmptyHostDashboard(actor, hostUser, isAccountInGoodStanding, opts?.listingId, reportingPeriod, entitlements);
    dashboardCache.set(cacheKey, { data: emptyData, expiresAt: nowMs + CACHE_TTL_MS });
    return emptyData;
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

  // Determine authoritative primary currency for reporting
  const distinctCurrencies = new Set<string>();
  for (const l of scopedListings) {
    distinctCurrencies.add(resolvePropertyCurrency(l));
  }
  const availableCurrencies = Array.from(distinctCurrencies).sort();
  const hasMixedCurrencies = availableCurrencies.length > 1;
  const requestedCurrency = opts?.currency ? normalizeCurrencyCode(opts.currency) : null;
  // Financial records are never added across currencies. For a mixed portfolio
  // the dashboard selects one native settlement currency (or a host's default)
  // and exposes every native total in `currencyBreakdown`.
  const primaryCurrency = opts?.listingId
    ? resolvePropertyCurrency(scopedListings[0])
    : requestedCurrency && availableCurrencies.includes(requestedCurrency)
      ? requestedCurrency
      : requestedCurrency === "SAR" || availableCurrencies.includes("SAR")
        ? "SAR"
        : availableCurrencies.includes(normalizeCurrencyCode(defaultPayoutCurrency))
          ? normalizeCurrencyCode(defaultPayoutCurrency)
          : requestedCurrency || availableCurrencies[0] || "SAR";

  // Telemetry aggregation is bounded to the selected reporting period and
  // runs alongside the heavier reservation aggregation below.
  const listingAnalyticsPromise = getListingAnalyticsSummary({
    listingIds: scopedListingIds,
    startDate: reportingPeriod.startDate,
    endDate: reportingPeriod.endDate,
  });

  // 3. Rolling 12-month window bounds for Superhost & Historical calculations
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  // Calendar Month and Year bounds for Earnings
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const startOfPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const endOfPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  // 4. Fetch all bookings across scoped listings
  const allBookings = await prisma.booking.findMany({
    where: { listingId: { in: scopedListingIds } },
    // Keep the authoritative dashboard calculation in one pass, but avoid
    // hydrating payment/refund relation arrays and unused booking columns.
    select: {
      id: true,
      listingId: true,
      userId: true,
      status: true,
      startDate: true,
      endDate: true,
      propertyTimeZone: true,
      checkInTime: true,
      checkOutTime: true,
      createdAt: true,
      guests: true,
      currency: true,
      totalPrice: true,
      cleaningFee: true,
      priceBreakdown: true,
      checkInInstructionsViewedAt: true,
      payments: { select: { status: true, capturedAmount: true } },
      refunds: { select: { status: true, amount: true } },
      qualityIncidents: { select: { status: true } },
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
          country: true,
          checkInInstructions: true,
        },
      },
    },
  });

  // Six-month completed-stay analytics need residential origin
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
  let pendingApprovalCount = 0;
  let guestCancelledCount = 0;
  let hostCancelledCount = 0;
  let excludedHostCancelledCount = 0;
  let totalCancelledCount = 0;

  // This Month Snapshot accumulators
  let thisMonthBookingsCount = 0;
  let previousMonthBookingsCount = 0;
  let thisMonthCancellationsCount = 0;
  let thisMonthCompletedCount = 0;
  let thisMonthCompletedNights = 0;
  let prevMonthCompletedCount = 0;
  let prevMonthCompletedNights = 0;

  // Financial Earnings Accumulators (converted into primaryCurrency)
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
  let totalExtraGuestFeeCents = 0;
  let totalPetFeeCents = 0;
  let totalRefundedCents = 0;
  let totalRefundedCount = 0;
  let bookingsWithoutPayoutSnapshotCount = 0;
  let bookingsExcludedForPaymentStatusCount = 0;
  let reportingCompletedPayoutEligibleCount = 0;
  let reportingCompletedStaysCount = 0;
  let reportingCompletedNightsCount = 0;
  let reportingCompletedGuestTotalCents = 0;

  // Currency breakdown map to prevent silent currency mixing
  const currencyBuckets = new Map<
    string,
    {
      currency: string;
      monthlyEarningsCents: number;
      previousMonthEarningsCents: number;
      ytdEarningsCents: number;
      upcomingPayoutsCents: number;
      completedPayoutsCents: number;
      grossVolumeCents: number;
      netPayoutCents: number;
      bookingCount: number;
    }
  >();

  const getOrCreateBucket = (curr: string) => {
    let b = currencyBuckets.get(curr);
    if (!b) {
      b = {
        currency: curr,
        monthlyEarningsCents: 0,
        previousMonthEarningsCents: 0,
        ytdEarningsCents: 0,
        upcomingPayoutsCents: 0,
        completedPayoutsCents: 0,
        grossVolumeCents: 0,
        netPayoutCents: 0,
        bookingCount: 0,
      };
      currencyBuckets.set(curr, b);
    }
    return b;
  };

  // Guest Analytics tracking
  const guestBookingCounts = new Map<string, number>();
  const guestOriginMap = new Map<string, { country: string; city: string | null; guestIds: Set<string> }>();
  let completedGuestStaysCount = 0;
  const guestsWithoutRecordedOrigin = new Set<string>();
  let staysWithoutRecordedOriginCount = 0;

  // Per-listing booking aggregations for Guest Favorite
  const listingBookingStats = new Map<
    string,
    { totalBookings: number; completedStays: number; hostCancellations: number; reliabilityBookings: number }
  >();
  for (const id of scopedListingIds) {
    listingBookingStats.set(id, { totalBookings: 0, completedStays: 0, hostCancellations: 0, reliabilityBookings: 0 });
  }
  const payoutStates = new Map<string, BookingPayoutCalculation>();

  for (const b of allBookings) {
    const startKey = bookingDateKey(b.startDate);
    const endKey = bookingDateKey(b.endDate);
    const nights = differenceInBookingNights(b.startDate, b.endDate);
    const payout = extractStoredHostPayout(b);
    const bCurrency = normalizeCurrencyCode(b.currency || resolvePropertyCurrency(b.listing));
    const belongsToReportingCurrency = bCurrency === primaryCurrency;
    const currBucket = getOrCreateBucket(bCurrency);
    currBucket.bookingCount++;

    const stats = listingBookingStats.get(b.listingId) || {
      totalBookings: 0,
      completedStays: 0,
      hostCancellations: 0,
      reliabilityBookings: 0,
    };
    stats.totalBookings++;

    // Booking activity uses the reservation creation timestamp. Stay-based
    // measures below intentionally use check-in/check-out dates instead.
    if (b.createdAt >= startOfMonth && b.createdAt <= endOfMonth) {
      if (b.status === BookingStatus.CONFIRMED) {
        thisMonthBookingsCount++;
      } else if (b.status === BookingStatus.CANCELLED) {
        thisMonthCancellationsCount++;
      }
    }
    if (b.createdAt >= startOfPreviousMonth && b.createdAt <= endOfPreviousMonth) {
      if (b.status === BookingStatus.CONFIRMED) {
        previousMonthBookingsCount++;
      }
    }

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
        excludedHostCancelledCount++;
      } else {
        guestCancelledCount++;
      }

      const refundAmount = extractRecordedCancellationRefund(b);
      if (belongsToReportingCurrency && refundAmount !== null && refundAmount > 0) {
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
      // This is the same payout-state classifier used by the Earnings pages.
      // A payout snapshot alone is not proof that the money is realized or paid.
      const payoutState = calculateBookingPayout(b, {
        now,
        hostPayoutMethods: typedHostPayoutMethods,
      });
      payoutStates.set(b.id, payoutState);
      const payoutEligible = payoutState.hasStoredSnapshot;
      const isRealizedPayout = payoutEligible && (
        payoutState.status === "PAID" || payoutState.status === "ELIGIBLE_SETTLEMENT"
      );
      const isOutstandingPayout = payoutEligible && (
        payoutState.status === "SCHEDULED"
        || payoutState.status === "ELIGIBLE_SETTLEMENT"
        || payoutState.status === "PROCESSING"
      );
      if (belongsToReportingCurrency && !payoutEligible && payout !== null) {
        bookingsExcludedForPaymentStatusCount++;
      }

      // Check operational status
      const statusDetail = computeBookingStatus({
        dbStatus: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        checkInStart: b.checkInTime,
        checkOutTime: b.checkOutTime,
        propertyTimeZone: b.propertyTimeZone,
        now,
      });

      if (statusDetail.status === "COMPLETED") {
        completedCount++;
        if (b.endDate >= reportingPeriod.startDate && b.endDate <= reportingPeriod.endDate) {
          reportingCompletedStaysCount++;
          reportingCompletedNightsCount += nights;
        }
        stats.completedStays++;
        stats.reliabilityBookings++;

        // Monthly snapshot stay length
        if (b.endDate >= startOfMonth && b.endDate <= endOfMonth) {
          thisMonthCompletedCount++;
          thisMonthCompletedNights += nights;
        }
        if (b.endDate >= startOfPreviousMonth && b.endDate <= endOfPreviousMonth) {
          prevMonthCompletedCount++;
          prevMonthCompletedNights += nights;
        }

        // Guest analytics (last 6 months)
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
              existingOrigin.guestIds.add(b.userId);
            } else {
              guestOriginMap.set(key, { country, city: city || null, guestIds: new Set([b.userId]) });
            }
          } else {
            if (!guestsWithoutRecordedOrigin.has(b.userId)) {
              guestsWithoutRecordedOrigin.add(b.userId);
              staysWithoutRecordedOriginCount++;
            }
          }
        }

        if (belongsToReportingCurrency && payout === null) {
          bookingsWithoutPayoutSnapshotCount++;
        }

        if (isRealizedPayout && payout) {

          // Currency-specific bucket accumulation (never combined)
          currBucket.netPayoutCents += payout.netHostPayout;
          currBucket.grossVolumeCents +=
            payout.accommodationSubtotal + payout.cleaningFee + payout.extraGuestFee + payout.petFee;

          if (payoutState.status === "PAID") {
            currBucket.completedPayoutsCents += payout.netHostPayout;
          }

          if (belongsToReportingCurrency) {
            if (payoutState.status === "PAID") {
              completedPayoutsCents += payout.netHostPayout;
            }
            totalAccommodationSubtotalCents += payout.accommodationSubtotal;
            totalCleaningFeeCents += payout.cleaningFee;
            totalHostServiceFeeCents += payout.hostServiceFee;
            totalTaxesCollectedForHostCents += payout.taxesCollectedForHost;
            totalNetHostPayoutCents += payout.netHostPayout;
            totalExtraGuestFeeCents += payout.extraGuestFee;
            totalPetFeeCents += payout.petFee;

            // The reporting filter controls the headline earnings period and
            // comparison; YTD remains a separately labelled calendar-year KPI.
            if (b.endDate >= reportingPeriod.startDate && b.endDate <= reportingPeriod.endDate) {
              monthlyEarningsCents += payout.netHostPayout;
              reportingCompletedPayoutEligibleCount++;
              reportingCompletedGuestTotalCents += extractStoredGuestTotal(b) ?? 0;
            }
            if (b.endDate >= reportingPeriod.comparisonStartDate && b.endDate <= reportingPeriod.comparisonEndDate) {
              previousMonthEarningsCents += payout.netHostPayout;
            }
            if (b.endDate >= startOfYear && b.endDate <= now) {
              ytdEarningsCents += payout.netHostPayout;
            }
          }
          if (b.endDate >= reportingPeriod.startDate && b.endDate <= reportingPeriod.endDate) {
            currBucket.monthlyEarningsCents += payout.netHostPayout;
          }
          if (b.endDate >= reportingPeriod.comparisonStartDate && b.endDate <= reportingPeriod.comparisonEndDate) {
            currBucket.previousMonthEarningsCents += payout.netHostPayout;
          }
          if (b.endDate >= startOfYear && b.endDate <= now) {
            currBucket.ytdEarningsCents += payout.netHostPayout;
          }
        }
      } else if (statusDetail.status === "CURRENT_STAY" || statusDetail.status === "CONFIRMED") {
        if (statusDetail.status === "CURRENT_STAY") currentStayCount++;
        else upcomingCount++;
      }

      if (isOutstandingPayout && payout) {
        if (belongsToReportingCurrency) upcomingPayoutsCents += payout.netHostPayout;
        currBucket.upcomingPayoutsCents += payout.netHostPayout;
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

  // 6. Next Upcoming Reservation & Upcoming List
  const futureConfirmedBookings = allBookings
    .filter((b: (typeof allBookings)[number]) => {
      if (b.status !== BookingStatus.CONFIRMED) return false;
      return computeBookingStatus({
        dbStatus: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        checkInStart: b.checkInTime,
        checkOutTime: b.checkOutTime,
        propertyTimeZone: b.propertyTimeZone,
        now,
      }).status === "CONFIRMED";
    })
    .sort((a: (typeof allBookings)[number], b: (typeof allBookings)[number]) => a.startDate.getTime() - b.startDate.getTime());
  // Outstanding payouts intentionally use the same state scope as Earnings:
  // scheduled, ready for settlement, or processing. This includes a ready
  // payout whose stay has already started, instead of silently reporting zero.
  const outstandingPayoutBookings = allBookings
    .filter((b: (typeof allBookings)[number]) => {
      const payoutState = payoutStates.get(b.id);
      return b.status === BookingStatus.CONFIRMED
        && normalizeCurrencyCode(b.currency || resolvePropertyCurrency(b.listing)) === primaryCurrency
        && Boolean(payoutState?.hasStoredSnapshot)
        && Boolean(payoutState && ["SCHEDULED", "ELIGIBLE_SETTLEMENT", "PROCESSING"].includes(payoutState.status));
    })
    .sort((a: (typeof allBookings)[number], b: (typeof allBookings)[number]) => {
      const aDate = payoutStates.get(a.id)?.scheduledPayoutDate.getTime() ?? a.startDate.getTime();
      const bDate = payoutStates.get(b.id)?.scheduledPayoutDate.getTime() ?? b.startDate.getTime();
      return aDate - bDate;
    });

  const nextBooking = futureConfirmedBookings[0] || null;
  const nextPayout = nextBooking ? extractStoredHostPayout(nextBooking) : null;
  const nextPayoutEligible = nextBooking !== null && Boolean(payoutStates.get(nextBooking.id)?.hasStoredSnapshot);
  const nextEligiblePayoutBooking = outstandingPayoutBookings[0] || null;
  const nextEligiblePayout = nextEligiblePayoutBooking ? extractStoredHostPayout(nextEligiblePayoutBooking) : null;
  const nextEligiblePayoutState = nextEligiblePayoutBooking
    ? payoutStates.get(nextEligiblePayoutBooking.id) ?? null
    : null;

  const nextUpcomingReservation = nextBooking
    ? {
        id: nextBooking.id,
        guestName: nextBooking.user?.name || "Guest",
        guestImage: nextBooking.user?.image ?? null,
        listingId: nextBooking.listingId,
        listingTitle: nextBooking.listing.title,
        startDate: bookingDateKey(nextBooking.startDate),
        endDate: bookingDateKey(nextBooking.endDate),
        checkInTime: nextBooking.checkInTime || "15:00",
        nights: differenceInBookingNights(nextBooking.startDate, nextBooking.endDate),
        guests: nextBooking.guests,
        hostPayoutCents: nextPayout ? nextPayout.netHostPayout : 0,
        isPayoutEligible: nextPayoutEligible,
        currency: nextBooking.currency || resolvePropertyCurrency(nextBooking.listing),
        status: "CONFIRMED",
      }
    : null;

  const upcomingReservations = futureConfirmedBookings.slice(0, 5).map((b: (typeof allBookings)[number]) => {
    const p = extractStoredHostPayout(b);
    return {
      id: b.id,
      guestName: b.user?.name || "Guest",
      guestImage: b.user?.image ?? null,
      listingId: b.listingId,
      listingTitle: b.listing.title,
      startDate: bookingDateKey(b.startDate),
      endDate: bookingDateKey(b.endDate),
      checkInTime: b.checkInTime || "15:00",
      nights: differenceInBookingNights(b.startDate, b.endDate),
      guests: b.guests,
      hostPayoutCents: p ? p.netHostPayout : 0,
      isPayoutEligible: Boolean(payoutStates.get(b.id)?.hasStoredSnapshot),
      currency: b.currency || resolvePropertyCurrency(b.listing),
      status: "CONFIRMED",
    };
  });

  // Next Payout Status and Arrival info
  const nextPayoutStatus = nextEligiblePayoutState?.status ?? null;
  // The documented check-in + 24-hour rule is an eligibility rule, not a
  // promise that a bank transfer was initiated or will arrive on that date.
  const nextPayoutExpectedArrival = nextEligiblePayoutState
    ? nextEligiblePayoutState.status === "SCHEDULED"
      ? `Eligible for settlement after ${bookingDateKey(nextEligiblePayoutState.scheduledPayoutDate)}.`
      : nextEligiblePayoutState.status === "ELIGIBLE_SETTLEMENT"
        ? "Ready for administrator settlement."
        : "Settlement processing."
    : null;

  // 7. Authoritative inventory calculations
  const listingsWithStays = new Set<string>();
  for (const b of allBookings) {
    if (b.status === BookingStatus.CONFIRMED) {
      listingsWithStays.add(b.listingId);
    }
  }
  const inventoryListings = scopedListings.filter(
    (listing) => (listing.published && listing.status === "ACTIVE" && !listing.isPaused) || listingsWithStays.has(listing.id),
  );
  const occupancyInventory = calculateDashboardInventory({
    listings: inventoryListings,
    bookings: allBookings,
    startDateKey: reportingPeriod.startDateKey,
    endDateKeyExclusive: shiftBookingDateKey(reportingPeriod.endDateKey, 1),
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
    direction: ReviewDirection.GUEST_TO_PROPERTY,
  };
  const [reviews, recentReviews] = await Promise.all([
    prisma.review.findMany({
      where: { ...reviewScope },
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
      where: { ...reviewScope },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        author: { select: { name: true, image: true } },
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

    const listingReview = r.listingId ? listingReviewMap.get(r.listingId) : undefined;
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

  // 9. Superhost remains an owner-level rolling program calculation. Dashboard
  // response metrics, however, follow the selected Insights reporting scope.
  const [superhostStatus, messagingMetrics] = await Promise.all([
    getLiveSuperhostStatus(actor.id, now),
    messagingService.calculateHostResponseMetrics(actor.id, {
      windowStart: reportingPeriod.startDate,
      windowEndExclusive: new Date(reportingPeriod.endDate.getTime() + 1),
      listingId: opts?.listingId,
    }),
  ]);

  const meetsReservationOrNightsThreshold = superhostStatus.hostingVolume.met;
  const meetsRatingThreshold = superhostStatus.ratingMet;
  const meetsResponseRateThreshold = superhostStatus.responseRateMet;
  const meetsCancellationThreshold = superhostStatus.cancellationMet;
  const gaps = superhostStatus.failureReasons;
  const isSuperhostQualified = superhostStatus.eligibleNow;

  // 10. Guest Analytics
  const uniqueGuestsCount = guestBookingCounts.size;
  let returningGuestsCount = 0;
  for (const count of guestBookingCounts.values()) {
    if (count >= 2) returningGuestsCount++;
  }
  const returningGuestsPercentage =
    uniqueGuestsCount > 0 ? Math.round((returningGuestsCount / uniqueGuestsCount) * 100) : 0;

  const totalGuestsWithKnownOrigin = Array.from(guestOriginMap.values()).reduce(
    (sum, origin) => sum + origin.guestIds.size,
    0,
  );
  const guestOrigins = Array.from(guestOriginMap.values())
    .map((origin) => ({
      country: origin.country,
      city: origin.city,
      guestCount: origin.guestIds.size,
      sharePercentage: totalGuestsWithKnownOrigin > 0
        ? Math.round((origin.guestIds.size / totalGuestsWithKnownOrigin) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.guestCount - a.guestCount || a.country.localeCompare(b.country));
  const guestOriginCountryMap = new Map<string, number>();
  for (const origin of guestOrigins) {
    guestOriginCountryMap.set(
      origin.country,
      (guestOriginCountryMap.get(origin.country) ?? 0) + origin.guestCount,
    );
  }
  const guestOriginCountries = Array.from(guestOriginCountryMap.entries())
    .map(([country, guestCount]) => ({
      country,
      guestCount,
      sharePercentage: totalGuestsWithKnownOrigin > 0
        ? Math.round((guestCount / totalGuestsWithKnownOrigin) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.guestCount - a.guestCount || a.country.localeCompare(b.country));

  const checkInTrackingStart = getCheckInTrackingStartDate();
  const checkInEligibleBookings = checkInTrackingStart
    ? allBookings.filter((booking) =>
        booking.status === BookingStatus.CONFIRMED
        && booking.startDate <= now
        && booking.endDate >= checkInTrackingStart
        && booking.endDate >= reportingPeriod.startDate
        && booking.endDate <= reportingPeriod.endDate
        && Boolean(booking.listing.checkInInstructions?.trim()),
      )
    : [];
  const checkInViewedCount = checkInEligibleBookings.filter(
    (booking) => booking.checkInInstructionsViewedAt !== null,
  ).length;
  const checkInInstructionsViewed = checkInTrackingStart
    ? {
        status: "ACTIVE" as const,
        message: "Guest instruction views are recorded from the configured tracking start date; future stays are excluded.",
        viewedCount: checkInViewedCount,
        notViewedCount: Math.max(0, checkInEligibleBookings.length - checkInViewedCount),
        eligibleReservationsCount: checkInEligibleBookings.length,
        trackingStartedAt: checkInTrackingStart.toISOString(),
      }
    : {
        status: "DATA_UNAVAILABLE" as const,
        message: "Check-in instruction engagement will be available after the tracking start date is configured for this deployment.",
        viewedCount: 0,
        notViewedCount: 0,
        eligibleReservationsCount: 0,
        trackingStartedAt: null,
      };

  // 11. Listing Performance Counts
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

  // 12. Cancellation Rates
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

  // 13. Average Booking Value & Stay Length
  const averageBookingValue = {
    hostPayoutCents: reportingCompletedPayoutEligibleCount > 0 ? Math.round(monthlyEarningsCents / reportingCompletedPayoutEligibleCount) : null,
    guestTotalCents: reportingCompletedPayoutEligibleCount > 0 ? Math.round(reportingCompletedGuestTotalCents / reportingCompletedPayoutEligibleCount) : 0,
    currency: primaryCurrency,
    completedBookingsCount: reportingCompletedPayoutEligibleCount,
    periodLabel: `${reportingPeriod.label} eligible completed stays`,
  };

  const averageStayLength = {
    nights: reportingCompletedStaysCount > 0 ? Math.round((reportingCompletedNightsCount / reportingCompletedStaysCount) * 10) / 10 : 0,
    completedStaysCount: reportingCompletedStaysCount,
    periodLabel: `${reportingPeriod.label} completed stays`,
  };

  // Recommendations
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

  // 14. Guest Favorite Per-Listing Summary
  const emptyReviewSubratings = () => ({
    cleanliness: { sum: 0, count: 0 },
    accuracy: { sum: 0, count: 0 },
    checkIn: { sum: 0, count: 0 },
    communication: { sum: 0, count: 0 },
    location: { sum: 0, count: 0 },
    value: { sum: 0, count: 0 },
  });
  const guestFavoriteSummary: HostDashboardGuestFavoriteListingItem[] = scopedListings.map((l) => {
    const bStats = listingBookingStats.get(l.id) || { totalBookings: 0, completedStays: 0, hostCancellations: 0, reliabilityBookings: 0 };
    const rStats = listingReviewMap.get(l.id) ?? { count: 0, sum: 0, subratings: emptyReviewSubratings() };

    const listingRating = rStats.count > 0 ? Math.round((rStats.sum / rStats.count) * 100) / 100 : null;
    const sub = (key: keyof typeof rStats.subratings) => {
      const entry = rStats.subratings[key];
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
      totalBookings: bStats.totalBookings,
      hostCancellationCount: bStats.hostCancellations,
      qualityIncidentCount: null,
    });

    return {
      listingId: l.id,
      title: l.title,
      status: l.status,
      published: Boolean(l.published),
      officialStatus: Boolean(l.isGuestFavorite),
      guestFavoriteSince: l.guestFavoriteSince?.toISOString() ?? null,
      lastEvaluatedAt: (l as { guestFavoriteLastEvaluatedAt?: Date | null }).guestFavoriteLastEvaluatedAt?.toISOString() ?? null,
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
    periodLabel: reportingPeriod.label,
    monthlyEarnings: {
      amountCents: monthlyEarningsCents,
      currency: primaryCurrency,
      periodLabel: reportingPeriod.label,
      previousMonthAmountCents: previousMonthEarningsCents,
      changePercentage: earningsMoMChangePercentage,
    },
    ytdEarnings: {
      amountCents: ytdEarningsCents,
      currency: primaryCurrency,
      periodLabel: "Current Year",
    },
    upcomingPayout: {
      totalUpcomingAmountCents: upcomingPayoutsCents,
      currency: primaryCurrency,
      nextPayoutAmountCents: nextEligiblePayout ? nextEligiblePayout.netHostPayout : null,
      nextEligibleStayStartDate: nextEligiblePayoutBooking ? bookingDateKey(nextEligiblePayoutBooking.startDate) : null,
      nextPayoutListingTitle: nextEligiblePayoutBooking ? nextEligiblePayoutBooking.listing.title : null,
      nextPayoutGuestName: nextEligiblePayoutBooking ? nextEligiblePayoutBooking.user?.name || "Guest" : null,
      nextPayoutStatus,
      nextPayoutExpectedArrival,
      nextPayoutMethodMasked: maskedPayoutMethod,
      count: outstandingPayoutBookings.length,
      excludedForPaymentStatusCount: allBookings.filter((booking: { status: BookingStatus; currency: string; listing: { country: string | null } }) => booking.status === BookingStatus.CONFIRMED && normalizeCurrencyCode(booking.currency || resolvePropertyCurrency(booking.listing)) === primaryCurrency).length - outstandingPayoutBookings.length,
      periodLabel: "Scheduled, ready, or processing payouts",
    },
    occupancy: {
      ratePercentage: occupancyInventory.ratePercentage,
      bookedNights: occupancyInventory.bookedNights,
      availableNights: occupancyInventory.availableNights,
      totalBookableNights: occupancyInventory.bookableNights,
      blockedNights: occupancyInventory.blockedNights,
      periodLabel: reportingPeriod.label,
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
    upcomingReservations,
  };

  // This Month Snapshot
  const thisMonthTotalActivity = thisMonthBookingsCount + thisMonthCancellationsCount;
  const thisMonthCancellationRate = thisMonthTotalActivity > 0
    ? Math.round((thisMonthCancellationsCount / thisMonthTotalActivity) * 1000) / 10
    : 0;
  const thisMonthMoMChange = previousMonthBookingsCount > 0
    ? Math.round(((thisMonthBookingsCount - previousMonthBookingsCount) / previousMonthBookingsCount) * 100)
    : null;
  const thisMonthAvgStay = thisMonthCompletedCount > 0
    ? Math.round((thisMonthCompletedNights / thisMonthCompletedCount) * 10) / 10
    : 0;
  const prevMonthAvgStay = prevMonthCompletedCount > 0
    ? Math.round((prevMonthCompletedNights / prevMonthCompletedCount) * 10) / 10
    : 0;

  const thisMonthSnapshot: HostDashboardThisMonthSnapshot = {
    periodLabel: startOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    bookingsCount: thisMonthBookingsCount,
    previousMonthBookingsCount,
    bookingsChangePercentage: thisMonthMoMChange,
    cancellationsCount: thisMonthCancellationsCount,
    cancellationRatePercentage: thisMonthCancellationRate,
    averageStayNights: thisMonthAvgStay,
    previousMonthAverageStayNights: prevMonthAvgStay,
  };

  const currencyBreakdown = Array.from(currencyBuckets.values()).sort((a, b) => b.completedPayoutsCents - a.completedPayoutsCents);
  const listingAnalytics = await listingAnalyticsPromise;

  const result: HostDashboardData = {
    hostId: actor.id,
    hostName: hostUser?.name || null,
    hostEmail: hostUser?.email || null,
    accountStatus,
    isAccountInGoodStanding,
    filterListingId: opts?.listingId || null,
    listings: scopedListings.map((listing) => ({ id: listing.id, title: listing.title })),
    filterCurrency: primaryCurrency,
    availableCurrencies,
    reportingPeriod: {
      preset: reportingPeriod.preset,
      label: reportingPeriod.label,
      startDateKey: reportingPeriod.startDateKey,
      endDateKey: reportingPeriod.endDateKey,
      comparisonStartDateKey: reportingPeriod.comparisonStartDateKey,
      comparisonEndDateKey: reportingPeriod.comparisonEndDateKey,
      comparisonLabel: reportingPeriod.comparisonLabel,
    },
    thisMonthSnapshot,
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
    reportingActivity: {
      confirmedBookingsCount: allBookings.filter((booking: { status: BookingStatus; createdAt: Date }) => booking.status === BookingStatus.CONFIRMED && booking.createdAt >= reportingPeriod.startDate && booking.createdAt <= reportingPeriod.endDate).length,
      completedStaysCount: reportingCompletedStaysCount,
      completedNightsCount: reportingCompletedNightsCount,
      cancelledBookingsCount: allBookings.filter((booking: { status: BookingStatus; createdAt: Date }) => booking.status === BookingStatus.CANCELLED && booking.createdAt >= reportingPeriod.startDate && booking.createdAt <= reportingPeriod.endDate).length,
    },
    kpis,
    earnings: {
      monthlyEarningsCents,
      ytdEarningsCents,
      upcomingPayoutsCents,
      completedPayoutsCents,
      grossEarningsCents: totalAccommodationSubtotalCents + totalCleaningFeeCents + totalExtraGuestFeeCents + totalPetFeeCents,
      deductionsCents: totalHostServiceFeeCents,
      netEarningsCents: totalNetHostPayoutCents,
      currency: primaryCurrency,
      hasMixedCurrencies,
      currencyBreakdown,
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
        listingTitle: review.listing?.title ?? "Property",
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      })),
    },
    messaging: {
      responseRatePercentage: messagingMetrics.responseRatePercentage,
      averageResponseTimeMinutes: messagingMetrics.averageResponseTimeMinutes,
      totalGuestInquiries: messagingMetrics.totalGuestInquiries,
      respondedCount: messagingMetrics.respondedCount,
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
      checkInInstructionsViewed,
    },
    listingPerformance: {
      totalListings: scopedListings.length,
      activeListings,
      draftListings,
      pausedListings,
      pageViews: {
        status: listingAnalytics.status,
        message: listingAnalytics.message,
        count: listingAnalytics.listingViews,
        trackingStartedAt: listingAnalytics.trackingStartedAt,
      },
      conversionRate: {
        status: listingAnalytics.status,
        message: listingAnalytics.message,
        percentage: listingAnalytics.conversionRatePercentage,
        attributedConfirmedBookings: listingAnalytics.attributedConfirmedBookings,
        searchImpressions: listingAnalytics.searchImpressions,
        trackingStartedAt: listingAnalytics.trackingStartedAt,
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
        qualification: {
          eligibilityStatus: superhostStatus.qualification.eligibilityStatus,
          criteria: superhostStatus.qualification.criteria,
          missingInformation: superhostStatus.qualification.missingInformation,
          unresolvedPolicyDependencies: superhostStatus.qualification.unresolvedPolicyDependencies,
        },
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
    entitlements,
  };

  dashboardCache.set(cacheKey, { data: result, expiresAt: nowMs + CACHE_TTL_MS });
  return result;
}

/** Backward-compatible Dashboard export backed by the database-free shared policy. */
export function calculateDashboardInventory(input: {
  listings: DashboardInventoryListing[];
  bookings: DashboardInventoryBooking[];
  startDateKey: string;
  endDateKeyExclusive: string;
}) {
  return calculateSharedDashboardInventory(input);
}

/** Date-level Dashboard inventory export for consumers that need a heatmap. */
export function calculateDashboardInventoryByDate(input: {
  listings: DashboardInventoryListing[];
  bookings: DashboardInventoryBooking[];
  startDateKey: string;
  endDateKeyExclusive: string;
}): DashboardInventoryDatePoint[] {
  return calculateSharedDashboardInventoryByDate(input);
}

function createEmptyHostDashboard(
  actor: AuthUser,
  hostUser: { id: string; name: string | null; email: string | null; status: UserStatus } | null,
  isAccountInGoodStanding: boolean,
  filterListingId?: string | null,
  period?: ResolvedReportingPeriod,
  entitlements?: HostDashboardEntitlements,
): HostDashboardData {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const repPeriod = period ?? resolveReportingPeriod({ period: "this_month" }, now);

  return {
    hostId: actor.id,
    hostName: hostUser?.name || null,
    hostEmail: hostUser?.email || null,
    accountStatus: hostUser?.status ?? UserStatus.ACTIVE,
    isAccountInGoodStanding,
    filterListingId: filterListingId || null,
    listings: [],
    filterCurrency: DEFAULT_CURRENCY,
    availableCurrencies: [],
    reportingPeriod: {
      preset: repPeriod.preset,
      label: repPeriod.label,
      startDateKey: repPeriod.startDateKey,
      endDateKey: repPeriod.endDateKey,
      comparisonStartDateKey: repPeriod.comparisonStartDateKey,
      comparisonEndDateKey: repPeriod.comparisonEndDateKey,
      comparisonLabel: repPeriod.comparisonLabel,
    },
    thisMonthSnapshot: {
      periodLabel: repPeriod.label,
      bookingsCount: 0,
      previousMonthBookingsCount: 0,
      bookingsChangePercentage: null,
      cancellationsCount: 0,
      cancellationRatePercentage: 0,
      averageStayNights: 0,
      previousMonthAverageStayNights: 0,
    },
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
    reportingActivity: {
      confirmedBookingsCount: 0,
      completedStaysCount: 0,
      completedNightsCount: 0,
      cancelledBookingsCount: 0,
    },
    kpis: {
      periodLabel: repPeriod.label,
      monthlyEarnings: {
        amountCents: 0,
        currency: DEFAULT_CURRENCY,
        periodLabel: "Current Month",
        previousMonthAmountCents: 0,
        changePercentage: null,
      },
      ytdEarnings: {
        amountCents: 0,
        currency: DEFAULT_CURRENCY,
        periodLabel: "Current Year",
      },
      upcomingPayout: {
        totalUpcomingAmountCents: 0,
        currency: DEFAULT_CURRENCY,
        nextPayoutAmountCents: null,
        nextEligibleStayStartDate: null,
        nextPayoutListingTitle: null,
        nextPayoutGuestName: null,
        nextPayoutStatus: null,
        nextPayoutExpectedArrival: null,
        nextPayoutMethodMasked: null,
        count: 0,
        excludedForPaymentStatusCount: 0,
        periodLabel: "Eligible Upcoming Stays",
      },
      occupancy: {
        ratePercentage: 0,
        bookedNights: 0,
        availableNights: 0,
        totalBookableNights: 0,
        blockedNights: 0,
        periodLabel: repPeriod.label,
      },
      averageBookingValue: {
        hostPayoutCents: null,
        guestTotalCents: 0,
        currency: DEFAULT_CURRENCY,
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
      upcomingReservations: [],
    },
    earnings: {
      monthlyEarningsCents: 0,
      ytdEarningsCents: 0,
      upcomingPayoutsCents: 0,
      completedPayoutsCents: 0,
      grossEarningsCents: 0,
      deductionsCents: 0,
      netEarningsCents: 0,
      currency: DEFAULT_CURRENCY,
      hasMixedCurrencies: false,
      currencyBreakdown: [],
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
      respondedCount: 0,
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
        message: "Check-in instruction engagement will be available after the tracking start date is configured for this deployment.",
        viewedCount: 0,
        notViewedCount: 0,
        eligibleReservationsCount: 0,
        trackingStartedAt: null,
      },
    },
    listingPerformance: {
      totalListings: 0,
      activeListings: 0,
      draftListings: 0,
      pausedListings: 0,
      pageViews: {
        status: "DATA_UNAVAILABLE",
        message: "Listing analytics storage is not available in this deployment yet.",
        count: 0,
        trackingStartedAt: null,
      },
      conversionRate: {
        status: "DATA_UNAVAILABLE",
        message: "Listing analytics storage is not available in this deployment yet.",
        percentage: null,
        attributedConfirmedBookings: 0,
        searchImpressions: 0,
        trackingStartedAt: null,
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
            qualification: {
              eligibilityStatus: "CANNOT_DETERMINE",
              criteria: [],
              missingInformation: ["Superhost qualification data is unavailable for this dashboard state."],
              unresolvedPolicyDependencies: [],
            },
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
    entitlements: entitlements ?? resolveHostDashboardEntitlements(null, actor.role),
  };
}
