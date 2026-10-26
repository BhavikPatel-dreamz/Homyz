import "server-only";

import { BookingStatus, OperatingExpenseStatus, Role } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { authorize } from "@/lib/permissions/authorize";
import { assertHostPermission } from "@/lib/permissions/host-permissions-server";
import { prisma } from "@/lib/db/prisma";
import { bookingDateKey, shiftBookingDateKey } from "@/lib/booking/booking-date";
import { extractStoredGuestTotal, extractStoredHostPayout, isStoredBookingPayoutEligible } from "@/lib/booking/booking-financials";
import { normalizeCurrencyCode } from "@/lib/currency";
import {
  calculateDashboardInventory,
  type DashboardInventoryBooking,
  type DashboardInventoryListing,
} from "@/services/host-dashboard.service";
import { resolveReportingPeriod, type DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { AppError } from "@/lib/api/errors";
import { accessibleHostListingWhere } from "@/lib/permissions/host-listing-access";

export interface HostEarningsAnalyticsQuery {
  listingId?: string;
  period?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  currency?: string;
  propertyPage?: number;
  propertyPageSize?: number;
  propertySearch?: string;
  propertySort?: "net" | "gross" | "revpan" | "occupancy" | "bookings" | "nightly_rate";
  propertyStatus?: "all" | "with_earnings" | "without_earnings";
}

export interface HostEarningsAnalyticsData {
  reportingPeriod: {
    label: string;
    startDateKey: string;
    endDateKey: string;
    comparisonLabel: string;
  };
  selectedListingId: string | null;
  currency: string | null;
  listings: Array<{ id: string; title: string }>;
  revenue: {
    recordedGrossBookingRevenueCents: number | null;
    eligibleAccommodationRevenueCents: number;
    netHostEarningsCents: number;
    hostServiceFeesCents: number;
    extraGuestFeesCents: number;
    petFeesCents: number;
    cleaningFeesCents: number;
    taxesCollectedForHostCents: number;
    qualifyingBookingsCount: number;
    completedNightsCount: number;
    revenuePerBookingCents: number | null;
    netPerBookingCents: number | null;
    averageRealizedNightlyRateCents: number | null;
    previousNetHostEarningsCents: number;
    previousAccommodationRevenueCents: number;
  };
  revpan: {
    valueCents: number | null;
    previousValueCents: number | null;
    bookedNights: number;
    availableNights: number;
    bookableNights: number;
    occupancyRatePercentage: number;
  };
  costs: {
    status: "AVAILABLE" | "NO_EXPENSES_RECORDED";
    message: string;
    totalRecordedOperatingCostsCents: number;
    costPerCompletedStayCents: number | null;
    costPerOccupiedNightCents: number | null;
    categoryBreakdown: Array<{ category: string; amountCents: number }>;
    expenseCoverage: "NO_EXPENSES_RECORDED" | "PARTIAL_RECORDED_COSTS" | "RECORDED_COSTS";
    expenseHistory: Array<{ id: string; listingId: string; category: string; amountCents: number; currency: string; expenseDate: string; description: string | null }>;
  };
  profit: {
    status: "AVAILABLE" | "NO_EXPENSES_RECORDED";
    message: string;
    estimatedOperatingProfitCents: number | null;
    profitMarginPercentage: number | null;
  };
  trend: Array<{
    dateKey: string;
    label: string;
    accommodationRevenueCents: number;
    netHostEarningsCents: number;
    hostServiceFeesCents: number;
    qualifyingBookingsCount: number;
  }>;
  payoutBreakdown: {
    accommodationCents: number;
    cleaningFeesCents: number;
    hostServiceFeesCents: number;
    taxesCollectedForHostCents: number;
    netHostPayoutCents: number;
    message: string;
  };
  bookingSources: {
    status: "UNATTRIBUTED";
    message: string;
    sources: Array<{ source: "UNATTRIBUTED"; qualifyingBookingsCount: number; eligibleAccommodationRevenueCents: number; netHostEarningsCents: number; contributionPercentage: number | null }>;
  };
  properties: Array<{
    listingId: string;
    title: string;
    eligibleAccommodationRevenueCents: number;
    netHostEarningsCents: number;
    revpanCents: number | null;
    qualifyingBookingsCount: number;
    bookableNights: number;
    bookedNights: number;
    occupancyRatePercentage: number;
    averageRealizedNightlyRateCents: number | null;
  }>;
  propertyPagination: { page: number; pageSize: number; total: number; totalPages: number };
  propertySummary: {
    eligibleListingsCount: number;
    listingsWithEarningsCount: number;
    highestEarningProperty: { title: string; netHostEarningsCents: number } | null;
  };
  dataQuality: {
    unavailableFinancialSnapshotCount: number;
    costRecordingAvailable: true;
  };
}

type AnalyticsListing = DashboardInventoryListing & { title: string };
type AnalyticsBooking = DashboardInventoryBooking & {
  id: string;
  priceBreakdown: unknown;
  currency: string | null;
  totalPrice: number | null;
  cleaningFee: number | null;
};

function emptyTotals() {
  return { accommodation: 0, net: 0, bookings: 0, nights: 0, gross: 0, grossCount: 0, hostServiceFees: 0, extraGuestFees: 0, petFees: 0, cleaningFees: 0, taxes: 0 };
}

function moneyPer(total: number, divisor: number) {
  return divisor > 0 ? Math.round(total / divisor) : null;
}

export const hostEarningsAnalyticsService = {
  async getOverview(actor: AuthUser, query: HostEarningsAnalyticsQuery = {}): Promise<HostEarningsAnalyticsData> {
    authorize(actor, [Role.HOST, Role.ADMIN]);
    if (actor.role === Role.HOST) await assertHostPermission(actor.id, "listing.view");

    const reportingPeriod = resolveReportingPeriod({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    const comparisonPeriod = query.comparisonStartDate && query.comparisonEndDate
      ? resolveReportingPeriod({
        period: "custom",
        startDate: query.comparisonStartDate,
        endDate: query.comparisonEndDate,
      })
      : null;
    const listings = await prisma.listing.findMany({
      where: accessibleHostListingWhere(actor),
      select: { id: true, title: true, published: true, status: true, isPaused: true, blockedDates: true },
      orderBy: { title: "asc" },
    });
    if (query.listingId && !listings.some((listing) => listing.id === query.listingId)) {
      throw AppError.forbidden("Listing not found or access denied for this host.");
    }
    const scopedListings = query.listingId ? listings.filter((listing) => listing.id === query.listingId) : listings;
    const listingIds = scopedListings.map((listing) => listing.id);
    // Analytics never combines native settlement currencies. The route supplies the
    // host's display currency (SAR by default) when a currency is not explicit.
    const selectedCurrency = normalizeCurrencyCode(query.currency ?? "SAR");
    const now = new Date();
    const comparisonStartDate = comparisonPeriod?.startDate ?? reportingPeriod.comparisonStartDate;
    const comparisonEndDate = comparisonPeriod?.endDate ?? reportingPeriod.comparisonEndDate;
    const firstDate = comparisonStartDate < reportingPeriod.startDate
      ? comparisonStartDate
      : reportingPeriod.startDate;
    const bookings = listingIds.length ? await prisma.booking.findMany({
      where: {
        listingId: { in: listingIds },
        status: BookingStatus.CONFIRMED,
        endDate: { gte: firstDate, lte: reportingPeriod.endDate },
      },
      select: {
        listingId: true,
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        priceBreakdown: true,
        currency: true,
        totalPrice: true,
        cleaningFee: true,
      },
      orderBy: { endDate: "asc" },
    }) : [];

    const current = emptyTotals();
    const previous = emptyTotals();
    let unavailableFinancialSnapshotCount = 0;
    const propertyTotals = new Map(scopedListings.map((listing) => [listing.id, emptyTotals()]));
    const trendMap = new Map<string, { accommodation: number; net: number; fees: number; bookings: number }>();

    for (const booking of bookings as AnalyticsBooking[]) {
      if (booking.endDate > now) continue;
      const payout = extractStoredHostPayout(booking);
      if (!payout || !isStoredBookingPayoutEligible(booking)) {
        unavailableFinancialSnapshotCount++;
        continue;
      }
      const currency = normalizeCurrencyCode(payout.currency ?? booking.currency ?? "SAR");
      if (selectedCurrency && currency !== selectedCurrency) continue;
      const target = booking.endDate >= reportingPeriod.startDate && booking.endDate <= reportingPeriod.endDate
        ? current
        : booking.endDate >= comparisonStartDate && booking.endDate <= comparisonEndDate
          ? previous
          : null;
      if (!target) continue;
      const nights = Math.max(0, Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / 86_400_000));
      target.accommodation += payout.accommodationSubtotal;
      target.net += payout.netHostPayout;
      target.hostServiceFees += payout.hostServiceFee;
      target.extraGuestFees += payout.extraGuestFee;
      target.petFees += payout.petFee;
      target.cleaningFees += payout.cleaningFee;
      target.taxes += payout.taxesCollectedForHost;
      const gross = extractStoredGuestTotal(booking);
      if (gross !== null) {
        target.gross += gross;
        target.grossCount++;
      }
      target.bookings++;
      target.nights += nights;
      if (target === current) {
        const property = propertyTotals.get(booking.listingId);
        if (property) {
          property.accommodation += payout.accommodationSubtotal;
          property.net += payout.netHostPayout;
          property.bookings++;
          property.nights += nights;
        }
        const dateKey = bookingDateKey(booking.endDate);
        const point = trendMap.get(dateKey) ?? { accommodation: 0, net: 0, fees: 0, bookings: 0 };
        point.accommodation += payout.accommodationSubtotal;
        point.net += payout.netHostPayout;
        point.fees += payout.hostServiceFee;
        point.bookings++;
        trendMap.set(dateKey, point);
      }
    }

    const inventoryListings: AnalyticsListing[] = scopedListings
      .filter((listing) => listing.published && listing.status === "ACTIVE" && !listing.isPaused)
      .map((listing) => ({ id: listing.id, blockedDates: listing.blockedDates ?? [], title: listing.title }));
    const bookingInventory = bookings as DashboardInventoryBooking[];
    const inventory = calculateDashboardInventory({
      listings: inventoryListings,
      bookings: bookingInventory,
      startDateKey: reportingPeriod.startDateKey,
      endDateKeyExclusive: shiftBookingDateKey(reportingPeriod.endDateKey, 1),
    });
    const previousInventory = calculateDashboardInventory({
      listings: inventoryListings,
      bookings: bookingInventory,
      startDateKey: comparisonPeriod?.startDateKey ?? reportingPeriod.comparisonStartDateKey,
      endDateKeyExclusive: shiftBookingDateKey(comparisonPeriod?.endDateKey ?? reportingPeriod.comparisonEndDateKey, 1),
    });

    const properties = scopedListings.map((listing) => {
      const totals = propertyTotals.get(listing.id) ?? emptyTotals();
      const listingInventory = calculateDashboardInventory({
        listings: inventoryListings.filter((item) => item.id === listing.id),
        bookings: bookingInventory,
        startDateKey: reportingPeriod.startDateKey,
        endDateKeyExclusive: shiftBookingDateKey(reportingPeriod.endDateKey, 1),
      });
      return {
        listingId: listing.id,
        title: listing.title,
        eligibleAccommodationRevenueCents: totals.accommodation,
        netHostEarningsCents: totals.net,
        revpanCents: moneyPer(totals.accommodation, listingInventory.bookableNights),
        qualifyingBookingsCount: totals.bookings,
        bookableNights: listingInventory.bookableNights,
        bookedNights: listingInventory.bookedNights,
        occupancyRatePercentage: listingInventory.ratePercentage,
        averageRealizedNightlyRateCents: moneyPer(totals.accommodation, totals.nights),
      };
    });

    const expenses = listingIds.length ? await prisma.operatingExpense.findMany({
      where: {
        listingId: { in: listingIds },
        status: OperatingExpenseStatus.ACTIVE,
        expenseDate: { gte: reportingPeriod.startDate, lte: reportingPeriod.endDate },
        currency: selectedCurrency,
      },
      select: { id: true, listingId: true, category: true, amountCents: true, currency: true, expenseDate: true, description: true, bookingId: true },
      take: 1000,
    }) : [];
    const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    const expenseByCategory = new Map<string, number>();
    for (const expense of expenses) expenseByCategory.set(expense.category, (expenseByCategory.get(expense.category) ?? 0) + expense.amountCents);
    const costsStatus = expenses.length ? "AVAILABLE" as const : "NO_EXPENSES_RECORDED" as const;
    const qualifyingCompletedStays = current.bookings;
    const costCoverage = expenses.length === 0 ? "NO_EXPENSES_RECORDED" as const : "PARTIAL_RECORDED_COSTS" as const;
    const estimatedProfit = expenses.length ? current.net - expenseTotal : null;
    const propertySearch = query.propertySearch?.trim().toLocaleLowerCase();
    const propertyStatus = query.propertyStatus ?? "all";
    const propertySort = query.propertySort ?? "net";
    const filteredProperties = properties.filter((property) => {
      if (propertySearch && !property.title.toLocaleLowerCase().includes(propertySearch)) return false;
      if (propertyStatus === "with_earnings") return property.netHostEarningsCents !== 0;
      if (propertyStatus === "without_earnings") return property.netHostEarningsCents === 0;
      return true;
    }).sort((left, right) => {
      const metric = (property: typeof left) => {
        if (propertySort === "gross") return property.eligibleAccommodationRevenueCents;
        if (propertySort === "revpan") return property.revpanCents ?? -1;
        if (propertySort === "occupancy") return property.occupancyRatePercentage;
        if (propertySort === "bookings") return property.qualifyingBookingsCount;
        if (propertySort === "nightly_rate") return property.averageRealizedNightlyRateCents ?? -1;
        return property.netHostEarningsCents;
      };
      return metric(right) - metric(left) || left.title.localeCompare(right.title);
    });
    const propertyPageSize = Math.min(50, Math.max(10, query.propertyPageSize ?? 10));
    const propertyPageCount = Math.max(1, Math.ceil(filteredProperties.length / propertyPageSize));
    const propertyPage = Math.min(propertyPageCount, Math.max(1, query.propertyPage ?? 1));
    const pagedProperties = filteredProperties.slice((propertyPage - 1) * propertyPageSize, propertyPage * propertyPageSize);
    const highestEarningProperty = properties.reduce<typeof properties[number] | null>((highest, property) => !highest || property.netHostEarningsCents > highest.netHostEarningsCents ? property : highest, null);

    return {
      reportingPeriod: {
        label: reportingPeriod.label,
        startDateKey: reportingPeriod.startDateKey,
        endDateKey: reportingPeriod.endDateKey,
        comparisonLabel: comparisonPeriod ? `Compared with ${comparisonPeriod.label}` : reportingPeriod.comparisonLabel,
      },
      selectedListingId: query.listingId ?? null,
      currency: selectedCurrency,
      listings: listings.map((listing) => ({ id: listing.id, title: listing.title })),
      revenue: {
        recordedGrossBookingRevenueCents: current.grossCount === current.bookings ? current.gross : null,
        eligibleAccommodationRevenueCents: current.accommodation,
        netHostEarningsCents: current.net,
        hostServiceFeesCents: current.hostServiceFees,
        extraGuestFeesCents: current.extraGuestFees,
        petFeesCents: current.petFees,
        cleaningFeesCents: current.cleaningFees,
        taxesCollectedForHostCents: current.taxes,
        qualifyingBookingsCount: current.bookings,
        completedNightsCount: current.nights,
        revenuePerBookingCents: moneyPer(current.accommodation, current.bookings),
        netPerBookingCents: moneyPer(current.net, current.bookings),
        averageRealizedNightlyRateCents: moneyPer(current.accommodation, current.nights),
        previousNetHostEarningsCents: previous.net,
        previousAccommodationRevenueCents: previous.accommodation,
      },
      revpan: {
        valueCents: moneyPer(current.accommodation, inventory.bookableNights),
        previousValueCents: moneyPer(previous.accommodation, previousInventory.bookableNights),
        bookedNights: inventory.bookedNights,
        availableNights: inventory.availableNights,
        bookableNights: inventory.bookableNights,
        occupancyRatePercentage: inventory.ratePercentage,
      },
      costs: {
        status: costsStatus,
        message: expenses.length
          ? "Recorded operating costs are shown by expense date. Costs without a booking link are not allocated across stays."
          : "No operating expenses have been recorded for this period. This does not mean operating costs were zero.",
        totalRecordedOperatingCostsCents: expenseTotal,
        costPerCompletedStayCents: expenses.length ? moneyPer(expenseTotal, qualifyingCompletedStays) : null,
        costPerOccupiedNightCents: expenses.length ? moneyPer(expenseTotal, current.nights) : null,
        categoryBreakdown: Array.from(expenseByCategory.entries()).map(([category, amountCents]) => ({ category, amountCents })).sort((left, right) => right.amountCents - left.amountCents),
        expenseCoverage: costCoverage,
        expenseHistory: expenses.slice(0, 12).map((expense) => ({ id: expense.id, listingId: expense.listingId, category: expense.category, amountCents: expense.amountCents, currency: expense.currency, expenseDate: expense.expenseDate.toISOString(), description: expense.description })),
      },
      profit: {
        status: costsStatus,
        message: expenses.length
          ? "Estimated Profit Based on Recorded Costs. It is not a complete accounting profit statement."
          : "Estimated profit is unavailable until recorded operating costs exist for this period.",
        estimatedOperatingProfitCents: estimatedProfit,
        profitMarginPercentage: estimatedProfit !== null && current.net > 0 ? Math.round((estimatedProfit / current.net) * 1000) / 10 : null,
      },
      trend: Array.from(trendMap.entries()).map(([dateKey, point]) => ({
        dateKey,
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T00:00:00.000Z`)),
        accommodationRevenueCents: point.accommodation,
        netHostEarningsCents: point.net,
        hostServiceFeesCents: point.fees,
        qualifyingBookingsCount: point.bookings,
      })),
      payoutBreakdown: {
        accommodationCents: current.accommodation,
        cleaningFeesCents: current.cleaningFees,
        hostServiceFeesCents: current.hostServiceFees,
        taxesCollectedForHostCents: current.taxes,
        netHostPayoutCents: current.net,
        message: "Amounts come from immutable eligible booking payout snapshots. They represent realized settlement eligibility, not payment-transfer status.",
      },
      bookingSources: {
        status: "UNATTRIBUTED",
        message: "Booking source attribution is not recorded on reservations in this workspace. The eligible completed-stay population is shown as unattributed rather than assigned to an invented channel.",
        sources: [{ source: "UNATTRIBUTED", qualifyingBookingsCount: current.bookings, eligibleAccommodationRevenueCents: current.accommodation, netHostEarningsCents: current.net, contributionPercentage: current.accommodation > 0 ? 100 : null }],
      },
      properties: pagedProperties,
      propertyPagination: { page: propertyPage, pageSize: propertyPageSize, total: filteredProperties.length, totalPages: propertyPageCount },
      propertySummary: {
        eligibleListingsCount: scopedListings.length,
        listingsWithEarningsCount: properties.filter((property) => property.netHostEarningsCents !== 0).length,
        highestEarningProperty: highestEarningProperty && highestEarningProperty.netHostEarningsCents !== 0
          ? { title: highestEarningProperty.title, netHostEarningsCents: highestEarningProperty.netHostEarningsCents }
          : null,
      },
      dataQuality: { unavailableFinancialSnapshotCount, costRecordingAvailable: true },
    };
  },
};
