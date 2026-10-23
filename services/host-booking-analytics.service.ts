import "server-only";

import { BookingStatus, Role } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { AppError } from "@/lib/api/errors";
import { authorize } from "@/lib/permissions/authorize";
import { assertHostPermission } from "@/lib/permissions/host-permissions-server";
import { prisma } from "@/lib/db/prisma";
import { bookingDateKey, differenceInBookingNights, shiftBookingDateKey } from "@/lib/booking/booking-date";
import { calculateBookingLeadTimeDays, isLastMinuteBooking, LAST_MINUTE_LEAD_DAYS } from "@/lib/booking/booking-analytics";
import { extractStoredHostPayout, isStoredBookingPayoutEligible } from "@/lib/booking/booking-financials";
import { normalizeCurrencyCode } from "@/lib/currency";
import { resolveReportingPeriod, type DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { accessibleHostListingWhere } from "@/lib/permissions/host-listing-access";
import {
  calculateDashboardInventory,
  calculateDashboardInventoryByDate,
  type DashboardInventoryBooking,
  type DashboardInventoryListing,
} from "@/lib/dashboard/host-inventory";

export { LAST_MINUTE_LEAD_DAYS } from "@/lib/booking/booking-analytics";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LEAD_TIME_BUCKETS = [
  { id: "same_day", label: "Same day", min: 0, max: 0 },
  { id: "1_3", label: "1–3 days", min: 1, max: 3 },
  { id: "4_7", label: "4–7 days", min: 4, max: 7 },
  { id: "8_14", label: "8–14 days", min: 8, max: 14 },
  { id: "15_30", label: "15–30 days", min: 15, max: 30 },
  { id: "31_60", label: "31–60 days", min: 31, max: 60 },
  { id: "61_plus", label: "61+ days", min: 61, max: Number.POSITIVE_INFINITY },
] as const;
const STAY_LENGTH_BUCKETS = [
  { id: "1", label: "1 night", min: 1, max: 1 },
  { id: "2_3", label: "2–3 nights", min: 2, max: 3 },
  { id: "4_7", label: "4–7 nights", min: 4, max: 7 },
  { id: "8_14", label: "8–14 nights", min: 8, max: 14 },
  { id: "15_28", label: "15–28 nights", min: 15, max: 28 },
  { id: "29_plus", label: "29+ nights", min: 29, max: Number.POSITIVE_INFINITY },
] as const;

export interface HostBookingAnalyticsQuery {
  listingId?: string;
  period?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  currency?: string;
  /** Null intentionally requests the full portfolio for the dedicated comparison view. */
  propertyLimit?: number | null;
}

export interface HostBookingAnalyticsData {
  reportingPeriod: { label: string; startDateKey: string; endDateKey: string; comparisonLabel: string };
  selectedListingId: string | null;
  listings: Array<{ id: string; title: string }>;
  currency: string;
  definitions: {
    bookingTime: string;
    leadTime: string;
    occupancy: string;
    lastMinuteThresholdDays: number;
    timeZone: "UTC";
  };
  summary: {
    occupancyRatePercentage: number | null;
    previousOccupancyRatePercentage: number | null;
    bookedNights: number;
    availableNights: number;
    blockedNights: number;
    bookableNights: number;
    confirmedBookingsCount: number;
    completedStaysCount: number;
    averageLeadTimeDays: number | null;
    medianLeadTimeDays: number | null;
    averageStayNights: number | null;
    lastMinuteBookingsCount: number;
    lastMinuteBookingsPercentage: number | null;
    realizedNightlyRateCents: number | null;
  };
  occupancy: {
    status: "AVAILABLE" | "PARTIAL";
    message: string | null;
    heatmap: Array<{ dateKey: string; weekday: string; bookedNights: number; availableNights: number; blockedNights: number; bookableNights: number; occupancyRatePercentage: number | null; reservationCount: number }>;
    byWeekday: Array<{ weekday: string; bookedNights: number; bookableNights: number; occupancyRatePercentage: number | null }>;
    byMonth: Array<{ monthKey: string; bookedNights: number; bookableNights: number; occupancyRatePercentage: number | null }>;
  };
  bookingTimes: {
    status: "AVAILABLE";
    totalQualifyingBookings: number;
    peakWeekday: string | null;
    peakHour: number | null;
    cells: Array<{ weekday: string; weekdayIndex: number; hour: number; bookingsCount: number; sharePercentage: number }>;
  };
  leadTime: {
    coverage: { qualifyingBookingsCount: number; excludedMissingTimestampCount: number };
    shortestDays: number | null;
    longestDays: number | null;
    distribution: Array<{ id: string; label: string; bookingsCount: number; percentage: number }>;
  };
  stayLength: {
    distribution: Array<{ id: string; label: string; bookingsCount: number; bookedNights: number; percentage: number }>;
  };
  pricing: {
    status: "AVAILABLE" | "DATA_UNAVAILABLE" | "PARTIAL";
    message: string | null;
    realizedBookingCount: number;
    trend: Array<{ monthKey: string; averageNightlyRateCents: number | null; completedStaysCount: number }>;
  };
  properties: Array<{ listingId: string; title: string; confirmedBookingsCount: number; completedStaysCount: number; occupancyRatePercentage: number | null; bookedNights: number; averageStayNights: number | null; averageLeadTimeDays: number | null; lastMinuteBookingPercentage: number | null; realizedNightlyRateCents: number | null; eligibleAccommodationRevenueCents: number; averageBookingValueCents: number | null; cancellationRatePercentage: number | null; guestRating: number | null; responseRatePercentage: null; responseRateStatus: "DATA_UNAVAILABLE" }>;
  propertiesTotal: number;
}

type ListingRecord = DashboardInventoryListing & { title: string; published: boolean; status: string; isPaused: boolean };
type BookingRecord = DashboardInventoryBooking & { id: string; createdAt: Date; priceBreakdown: unknown; currency: string | null; totalPrice: number | null; cleaningFee: number | null };

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2 * 10) / 10;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
}

function bucketFor<T extends { min: number; max: number }>(buckets: readonly T[], value: number) {
  return buckets.find((bucket) => value >= bucket.min && value <= bucket.max) ?? null;
}

function inEventWindow(booking: BookingRecord, start: Date, end: Date) {
  return booking.createdAt >= start && booking.createdAt <= end;
}

function inCompletedStayWindow(booking: BookingRecord, start: Date, end: Date, now: Date) {
  return booking.endDate >= start && booking.endDate <= end && booking.endDate <= now;
}

export const hostBookingAnalyticsService = {
  async getOverview(actor: AuthUser, query: HostBookingAnalyticsQuery = {}): Promise<HostBookingAnalyticsData> {
    authorize(actor, [Role.HOST, Role.ADMIN]);
    if (actor.role === Role.HOST) await assertHostPermission(actor.id, "listing.view");

    const period = resolveReportingPeriod({ period: query.period, startDate: query.startDate, endDate: query.endDate });
    const comparison = query.comparisonStartDate && query.comparisonEndDate
      ? resolveReportingPeriod({ period: "custom", startDate: query.comparisonStartDate, endDate: query.comparisonEndDate })
      : null;
    const comparisonStart = comparison?.startDate ?? period.comparisonStartDate;
    const listings = await prisma.listing.findMany({
      where: accessibleHostListingWhere(actor),
      select: { id: true, title: true, published: true, status: true, isPaused: true, blockedDates: true },
      orderBy: { title: "asc" },
    });
    if (query.listingId && !listings.some((listing) => listing.id === query.listingId)) throw AppError.forbidden("Listing not found or access denied for this host.");
    const scopedListings = (query.listingId ? listings.filter((listing) => listing.id === query.listingId) : listings) as ListingRecord[];
    const allListingIds = scopedListings.map((listing) => listing.id);
    const eventStart = comparisonStart < period.startDate ? comparisonStart : period.startDate;
    const stayStart = comparisonStart < period.startDate ? comparisonStart : period.startDate;
    const now = new Date();
    const [bookings, cancelledBookings, ratingRows] = allListingIds.length ? await Promise.all([
      prisma.booking.findMany({
      where: {
        listingId: { in: allListingIds },
        status: BookingStatus.CONFIRMED,
        OR: [
          { startDate: { lte: period.endDate }, endDate: { gt: stayStart } },
          { createdAt: { gte: eventStart, lte: period.endDate } },
        ],
      },
      select: { id: true, listingId: true, status: true, startDate: true, endDate: true, createdAt: true, priceBreakdown: true, currency: true, totalPrice: true, cleaningFee: true },
      }) as Promise<BookingRecord[]>,
      prisma.booking.findMany({
        where: { listingId: { in: allListingIds }, status: BookingStatus.CANCELLED, createdAt: { gte: period.startDate, lte: period.endDate } },
        select: { listingId: true },
      }),
      prisma.review.groupBy({
        by: ["listingId"],
        where: { listingId: { in: allListingIds }, direction: "GUEST_TO_PROPERTY", status: "PUBLISHED" },
        _avg: { rating: true },
      }),
    ]) : [[], [], [] as Array<{ listingId: string | null; _avg: { rating: number | null } }>];

    const activeListings = scopedListings.filter((listing) => listing.published && listing.status === "ACTIVE" && !listing.isPaused);
    const inventoryBookings = bookings as DashboardInventoryBooking[];
    const heatmap = calculateDashboardInventoryByDate({
      listings: activeListings,
      bookings: inventoryBookings,
      startDateKey: period.startDateKey,
      endDateKeyExclusive: shiftBookingDateKey(period.endDateKey, 1),
    }).map(({ ratePercentage, ...point }) => ({ ...point, occupancyRatePercentage: ratePercentage, weekday: WEEKDAYS[new Date(`${point.dateKey}T00:00:00.000Z`).getUTCDay()] }));
    const inventory = calculateDashboardInventory({ listings: activeListings, bookings: inventoryBookings, startDateKey: period.startDateKey, endDateKeyExclusive: shiftBookingDateKey(period.endDateKey, 1) });
    const previousInventory = calculateDashboardInventory({ listings: activeListings, bookings: inventoryBookings, startDateKey: comparison?.startDateKey ?? period.comparisonStartDateKey, endDateKeyExclusive: shiftBookingDateKey(comparison?.endDateKey ?? period.comparisonEndDateKey, 1) });

    const eventBookings = bookings.filter((booking) => inEventWindow(booking, period.startDate, period.endDate));
    const completedStays = bookings.filter((booking) => inCompletedStayWindow(booking, period.startDate, period.endDate, now));
    const leadTimes = eventBookings.map((booking) => calculateBookingLeadTimeDays(booking.createdAt, booking.startDate));
    const stayNights = eventBookings.map((booking) => differenceInBookingNights(booking.startDate, booking.endDate)).filter((nights) => nights > 0);

    const cells = Array.from({ length: 7 * 24 }, (_, index) => ({ weekday: WEEKDAYS[Math.floor(index / 24)], weekdayIndex: Math.floor(index / 24), hour: index % 24, bookingsCount: 0, sharePercentage: 0 }));
    for (const booking of eventBookings) cells[booking.createdAt.getUTCDay() * 24 + booking.createdAt.getUTCHours()].bookingsCount++;
    for (const cell of cells) cell.sharePercentage = eventBookings.length ? Math.round((cell.bookingsCount / eventBookings.length) * 1000) / 10 : 0;
    const peakCell = [...cells].sort((left, right) => right.bookingsCount - left.bookingsCount)[0];

    const leadCounts = new Map(LEAD_TIME_BUCKETS.map((bucket) => [bucket.id, 0]));
    const stayCounts = new Map(STAY_LENGTH_BUCKETS.map((bucket) => [bucket.id, { bookings: 0, nights: 0 }]));
    for (const leadTime of leadTimes) {
      const bucket = bucketFor(LEAD_TIME_BUCKETS, leadTime);
      if (bucket) leadCounts.set(bucket.id, (leadCounts.get(bucket.id) ?? 0) + 1);
    }
    for (const nights of stayNights) {
      const bucket = bucketFor(STAY_LENGTH_BUCKETS, nights);
      if (bucket) {
        const stats = stayCounts.get(bucket.id)!;
        stats.bookings++;
        stats.nights += nights;
      }
    }

    const weekdayStats = new Map(WEEKDAYS.map((weekday) => [weekday, { booked: 0, bookable: 0 }]));
    const monthStats = new Map<string, { booked: number; bookable: number }>();
    for (const point of heatmap) {
      const weekday = weekdayStats.get(point.weekday)!;
      weekday.booked += point.bookedNights; weekday.bookable += point.bookableNights;
      const monthKey = point.dateKey.slice(0, 7);
      const month = monthStats.get(monthKey) ?? { booked: 0, bookable: 0 };
      month.booked += point.bookedNights; month.bookable += point.bookableNights;
      monthStats.set(monthKey, month);
    }

    const selectedCurrency = normalizeCurrencyCode(query.currency ?? "SAR");
    const rateMonths = new Map<string, { amount: number; nights: number; stays: number }>();
    const propertyRates = new Map(scopedListings.map((listing) => [listing.id, { amount: 0, net: 0, nights: 0, stays: 0 }]));
    let excludedFinancialSnapshotCount = 0;
    for (const booking of completedStays) {
      const payout = extractStoredHostPayout(booking);
      if (!payout || !isStoredBookingPayoutEligible(booking)) { excludedFinancialSnapshotCount++; continue; }
      if (normalizeCurrencyCode(payout.currency ?? booking.currency ?? "SAR") !== selectedCurrency) continue;
      const nights = differenceInBookingNights(booking.startDate, booking.endDate);
      if (!nights) continue;
      const monthKey = bookingDateKey(booking.endDate).slice(0, 7);
      const month = rateMonths.get(monthKey) ?? { amount: 0, nights: 0, stays: 0 };
      month.amount += payout.accommodationSubtotal; month.nights += nights; month.stays++;
      rateMonths.set(monthKey, month);
      const property = propertyRates.get(booking.listingId);
      if (property) { property.amount += payout.accommodationSubtotal; property.net += payout.netHostPayout; property.nights += nights; property.stays++; }
    }

    const cancelledByListing = new Map<string, number>();
    for (const booking of cancelledBookings) cancelledByListing.set(booking.listingId, (cancelledByListing.get(booking.listingId) ?? 0) + 1);
    const ratingByListing = new Map(ratingRows.filter((row) => row.listingId).map((row) => [row.listingId!, row._avg.rating === null ? null : Math.round(row._avg.rating * 100) / 100]));

    const propertyMetrics = scopedListings.map((listing) => {
      const listingInventory = calculateDashboardInventory({ listings: activeListings.filter((item) => item.id === listing.id), bookings: inventoryBookings, startDateKey: period.startDateKey, endDateKeyExclusive: shiftBookingDateKey(period.endDateKey, 1) });
      const listingEvents = eventBookings.filter((booking) => booking.listingId === listing.id);
      const listingLeadTimes = listingEvents.map((booking) => calculateBookingLeadTimeDays(booking.createdAt, booking.startDate));
      const listingStays = completedStays.filter((booking) => booking.listingId === listing.id);
      const completedNights = listingStays.map((booking) => differenceInBookingNights(booking.startDate, booking.endDate)).filter(Boolean);
      const rate = propertyRates.get(listing.id)!;
      const cancelledCount = cancelledByListing.get(listing.id) ?? 0;
      const cancellationDenominator = listingEvents.length + cancelledCount;
      return {
        listingId: listing.id,
        title: listing.title,
        confirmedBookingsCount: listingEvents.length,
        completedStaysCount: listingStays.length,
        occupancyRatePercentage: listingInventory.bookableNights ? listingInventory.ratePercentage : null,
        bookedNights: listingInventory.bookedNights,
        averageStayNights: average(completedNights),
        averageLeadTimeDays: average(listingLeadTimes),
        lastMinuteBookingPercentage: listingEvents.length ? Math.round((listingLeadTimes.filter(isLastMinuteBooking).length / listingEvents.length) * 1000) / 10 : null,
        realizedNightlyRateCents: rate.nights ? Math.round(rate.amount / rate.nights) : null,
        eligibleAccommodationRevenueCents: rate.amount,
        averageBookingValueCents: rate.stays ? Math.round(rate.net / rate.stays) : null,
        cancellationRatePercentage: cancellationDenominator ? Math.round((cancelledCount / cancellationDenominator) * 1000) / 10 : null,
        guestRating: ratingByListing.get(listing.id) ?? null,
        // Messaging only has a host-level response metric; never allocate it to a listing.
        responseRatePercentage: null,
        responseRateStatus: "DATA_UNAVAILABLE" as const,
      };
    });

    const isHistoricalWindow = period.endDateKey < bookingDateKey(now);
    const propertyLimit = query.propertyLimit === undefined ? 10 : query.propertyLimit;
    const visibleProperties = [...propertyMetrics]
      .sort((left, right) => right.confirmedBookingsCount - left.confirmedBookingsCount || left.title.localeCompare(right.title))
      .slice(0, propertyLimit === null ? undefined : Math.max(0, propertyLimit));
    return {
      reportingPeriod: { label: period.label, startDateKey: period.startDateKey, endDateKey: period.endDateKey, comparisonLabel: comparison ? `Compared with ${comparison.label}` : period.comparisonLabel },
      selectedListingId: query.listingId ?? null,
      listings: listings.map((listing) => ({ id: listing.id, title: listing.title })),
      currency: selectedCurrency,
      definitions: {
        bookingTime: "Confirmed reservations grouped by their booking creation timestamp (UTC).",
        leadTime: "Calendar days from booking creation date to check-in date; no confirmation timestamp is stored.",
        occupancy: "Confirmed booked nights divided by bookable inventory nights; confirmed bookings take precedence over manual blocks.",
        lastMinuteThresholdDays: LAST_MINUTE_LEAD_DAYS,
        timeZone: "UTC",
      },
      summary: {
        occupancyRatePercentage: inventory.bookableNights ? inventory.ratePercentage : null,
        previousOccupancyRatePercentage: previousInventory.bookableNights ? previousInventory.ratePercentage : null,
        bookedNights: inventory.bookedNights,
        availableNights: inventory.availableNights,
        blockedNights: inventory.blockedNights,
        bookableNights: inventory.bookableNights,
        confirmedBookingsCount: eventBookings.length,
        completedStaysCount: completedStays.length,
        averageLeadTimeDays: average(leadTimes),
        medianLeadTimeDays: median(leadTimes),
        averageStayNights: average(stayNights),
        lastMinuteBookingsCount: leadTimes.filter(isLastMinuteBooking).length,
        lastMinuteBookingsPercentage: eventBookings.length ? Math.round((leadTimes.filter(isLastMinuteBooking).length / eventBookings.length) * 1000) / 10 : null,
        realizedNightlyRateCents: Array.from(propertyRates.values()).reduce((sum, item) => sum + item.nights, 0) ? Math.round(Array.from(propertyRates.values()).reduce((sum, item) => sum + item.amount, 0) / Array.from(propertyRates.values()).reduce((sum, item) => sum + item.nights, 0)) : null,
      },
      occupancy: {
        status: isHistoricalWindow ? "PARTIAL" : "AVAILABLE",
        message: isHistoricalWindow ? "Calendar availability is not versioned. Booked nights are historical facts; the blocked-night denominator uses the currently recorded calendar blocks and is shown as partial coverage." : null,
        heatmap,
        byWeekday: WEEKDAYS.map((weekday) => { const item = weekdayStats.get(weekday)!; return { weekday, bookedNights: item.booked, bookableNights: item.bookable, occupancyRatePercentage: item.bookable ? Math.round((item.booked / item.bookable) * 1000) / 10 : null }; }),
        byMonth: Array.from(monthStats.entries()).map(([monthKey, item]) => ({ monthKey, bookedNights: item.booked, bookableNights: item.bookable, occupancyRatePercentage: item.bookable ? Math.round((item.booked / item.bookable) * 1000) / 10 : null })),
      },
      bookingTimes: { status: "AVAILABLE", totalQualifyingBookings: eventBookings.length, peakWeekday: peakCell?.bookingsCount ? peakCell.weekday : null, peakHour: peakCell?.bookingsCount ? peakCell.hour : null, cells },
      leadTime: { coverage: { qualifyingBookingsCount: eventBookings.length, excludedMissingTimestampCount: 0 }, shortestDays: leadTimes.length ? Math.min(...leadTimes) : null, longestDays: leadTimes.length ? Math.max(...leadTimes) : null, distribution: LEAD_TIME_BUCKETS.map((bucket) => { const bookingsCount = leadCounts.get(bucket.id) ?? 0; return { id: bucket.id, label: bucket.label, bookingsCount, percentage: eventBookings.length ? Math.round((bookingsCount / eventBookings.length) * 1000) / 10 : 0 }; }) },
      stayLength: { distribution: STAY_LENGTH_BUCKETS.map((bucket) => { const item = stayCounts.get(bucket.id)!; return { id: bucket.id, label: bucket.label, bookingsCount: item.bookings, bookedNights: item.nights, percentage: stayNights.length ? Math.round((item.bookings / stayNights.length) * 1000) / 10 : 0 }; }) },
      pricing: { status: !completedStays.length ? "DATA_UNAVAILABLE" : excludedFinancialSnapshotCount ? "PARTIAL" : "AVAILABLE", message: !completedStays.length ? "No completed stays fall within this reporting period." : excludedFinancialSnapshotCount ? `${excludedFinancialSnapshotCount} completed stay${excludedFinancialSnapshotCount === 1 ? "" : "s"} excluded because an eligible immutable financial snapshot was unavailable.` : null, realizedBookingCount: Array.from(propertyRates.values()).reduce((sum, item) => sum + item.stays, 0), trend: Array.from(rateMonths.entries()).map(([monthKey, item]) => ({ monthKey, averageNightlyRateCents: item.nights ? Math.round(item.amount / item.nights) : null, completedStaysCount: item.stays })) },
      properties: visibleProperties,
      propertiesTotal: propertyMetrics.length,
    };
  },
};
