import { prisma } from "@/lib/db/prisma";
import { BookingStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import {
  calculateBookingPayout,
  type HostPayoutMethod,
  type PayoutAdjustmentRecord,
  type HostEarningsPayoutPreview,
  type BookingPayoutCalculation,
} from "@/services/payout.service";
import { extractStoredHostPayout } from "@/lib/booking/booking-financials";
import { SimplePdfDocument } from "@/lib/export/pdf-generator";
import { defaultExportFields, DEFAULT_EXPORT_FIELDS } from "@/lib/export/report-constants";

// CSV and PDF rendering are generated in-process. Keep an explicit bounded
// export contract rather than risking an unbounded allocation or timeout.
const MAX_REPORT_BOOKINGS = 10_000;

export interface MonthlyReportCard {
  year: number;
  month: number;
  monthName: string;
  label: string;
  dateRange: { start: string; end: string };
  grossEarnings: number;
  adjustments: number;
  platformFee: number;
  taxesWithheld: number;
  netEarnings: number;
  paidPayouts: number;
  upcomingPayouts: number;
  currency: string;
  status: "COMPLETED" | "IN_PROGRESS" | "NO_ACTIVITY";
  transactionCount: number;
}

export interface PropertyEarningsBreakdown {
  listingId: string;
  listingTitle: string;
  grossEarnings: number;
  deductions: number;
  netEarnings: number;
  transactionsCount: number;
  currency: string;
}

export interface EarningsTypeBreakdown {
  accommodation: number;
  cleaningFee: number;
  extraGuestFee: number;
  petFee: number;
  adjustments: number;
  currency: string;
}

export interface PayoutStatusBreakdown {
  paidVolume: number;
  paidCount: number;
  processingVolume: number;
  processingCount: number;
  scheduledVolume: number;
  scheduledCount: number;
  currency: string;
}

export interface PayoutMethodBreakdown {
  bankName: string;
  ibanMasked: string;
  amount: number;
  count: number;
  currency: string;
}

export interface HostEarningsReportsLandingData {
  selectedYear: number;
  availableYears: number[];
  selectedListingId: string | null;
  selectedCurrency: string | null;
  listings: Array<{ id: string; title: string }>;
  currencies: string[];
  yearlySummary: {
    grossEarnings: number;
    adjustments: number;
    platformFee: number;
    taxesWithheld: number;
    netEarnings: number;
    paidPayouts: number;
    upcomingPayouts: number;
    currency: string;
    transactionCount: number;
  };
  monthlyReports: MonthlyReportCard[];
}

export interface HostMonthlyEarningsReportData {
  year: number;
  month: number;
  monthName: string;
  monthLabel: string;
  dateRange: { start: string; end: string };
  selectedListingId: string | null;
  selectedCurrency: string;
  summary: {
    grossEarnings: number;
    adjustments: number;
    platformFee: number;
    taxesWithheld: number;
    netEarnings: number;
    paidPayouts: number;
    upcomingPayouts: number;
    currency: string;
  };
  propertyBreakdown: PropertyEarningsBreakdown[];
  earningsTypeBreakdown: EarningsTypeBreakdown;
  payoutStatusBreakdown: PayoutStatusBreakdown;
  payoutMethodBreakdown: PayoutMethodBreakdown[];
  transactions: HostEarningsPayoutPreview[];
  adjustmentsList: PayoutAdjustmentRecord[];
  listings: Array<{ id: string; title: string }>;
  currencies: string[];
}

export interface HostYearlyEarningsReportData {
  year: number;
  yearLabel: string;
  dateRange: { start: string; end: string };
  selectedListingId: string | null;
  selectedCurrency: string;
  summary: {
    grossEarnings: number;
    adjustments: number;
    platformFee: number;
    taxesWithheld: number;
    netEarnings: number;
    paidPayouts: number;
    upcomingPayouts: number;
    currency: string;
    transactionCount: number;
  };
  monthlyBreakdown: MonthlyReportCard[];
  propertyBreakdown: PropertyEarningsBreakdown[];
  earningsTypeBreakdown: EarningsTypeBreakdown;
  payoutStatusBreakdown: PayoutStatusBreakdown;
  payoutMethodBreakdown: PayoutMethodBreakdown[];
  listings: Array<{ id: string; title: string }>;
  currencies: string[];
}

export interface CustomReportQuery {
  period?:
    "this_month" | "last_month" | "this_year" | "previous_year" | "custom";
  startDate?: string;
  endDate?: string;
  listingId?: string;
  earningsType?: "all" | "reservation" | "adjustments";
  payoutStatus?: "all" | "paid" | "upcoming";
  payoutMethodMasked?: string;
  currency?: string;
  fields?: string[];
  format?: "csv" | "pdf";
}

const bookingInclude = {
  listing: { select: { id: true, title: true, photos: true } },
  payments: { select: { id: true, status: true, capturedAmount: true } },
  refunds: { select: { id: true, status: true, amount: true } },
  qualityIncidents: { select: { id: true, status: true } },
  user: { select: { id: true, name: true } },
} as const;

function positiveAdjustmentAmount(adjustment: PayoutAdjustmentRecord) {
  return adjustment.type === "DAMAGE_CLAIM_CREDIT" ||
    adjustment.type === "BONUS_CREDIT"
    ? adjustment.amount
    : -adjustment.amount;
}

function resolveOwnedListingId(
  listings: Array<{ id: string }>,
  requestedListingId?: string,
): string | null {
  if (!requestedListingId) return null;
  if (!listings.some((listing) => listing.id === requestedListingId)) {
    throw AppError.forbidden(
      "Listing not found or access denied for this host",
    );
  }
  return requestedListingId;
}

function toPayoutPreview(
  booking: any,
  calculation: BookingPayoutCalculation,
): HostEarningsPayoutPreview {
  return {
    bookingId: booking.id,
    listingId: booking.listingId,
    listingTitle: booking.listing.title,
    listingPhoto: booking.listing.photos?.[0] || null,
    guestName: booking.user?.name || "Guest",
    startDate: booking.startDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    scheduledPayoutDate: calculation.scheduledPayoutDate.toISOString(),
    grossEarnings: calculation.grossEarnings,
    platformFee: calculation.platformFee,
    deductions: calculation.deductions,
    netPayout: calculation.netPayout,
    currency: calculation.currency,
    status: calculation.status,
    executionDetails: calculation.executionDetails,
    holdDetails: calculation.holdDetails,
  };
}

/** The immutable payout snapshot is the settlement-currency source of truth. */
function settlementCurrencyForBooking(booking: unknown): string | null {
  return (
    extractStoredHostPayout(
      booking as Parameters<typeof extractStoredHostPayout>[0],
    )?.currency?.toUpperCase() || null
  );
}

function sanitizeCsv(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const hostReportingService = {
  /**
   * Generates the Airbnb-style Earnings Reports Landing Page data.
   */
  async getReportsLanding(
    hostId: string,
    query: { year?: number; listingId?: string; currency?: string } = {},
  ): Promise<HostEarningsReportsLandingData> {
    const user = await prisma.user.findUnique({
      where: { id: hostId },
      select: { personalInfo: true },
    });
    if (!user) throw AppError.notFound(`Host ${hostId} not found.`);

    const info = (user.personalInfo as Record<string, any>) || {};
    const payoutMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
      ? info.payoutMethods
      : [];
    const allAdjustments: PayoutAdjustmentRecord[] = Array.isArray(
      info.payoutAdjustments,
    )
      ? info.payoutAdjustments
      : [];

    const listings = await prisma.listing.findMany({
      where: { hostId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });
    const selectedListingId = resolveOwnedListingId(listings, query.listingId);
    const scopedListingIds = selectedListingId
      ? [selectedListingId]
      : listings.map((l: { id: string }) => l.id);

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const selectedYear =
      Number.isInteger(query.year) &&
      query.year! >= 2000 &&
      query.year! <= currentYear + 2
        ? query.year!
        : currentYear;

    // Discover available years from confirmed bookings
    const earliestBooking = await prisma.booking.findFirst({
      where: { listing: { hostId }, status: BookingStatus.CONFIRMED },
      orderBy: { endDate: "asc" },
      select: { endDate: true },
    });
    const earliestYear = earliestBooking
      ? earliestBooking.endDate.getUTCFullYear()
      : currentYear;
    const availableYears: number[] = [];
    for (
      let y = currentYear;
      y >= Math.min(earliestYear, currentYear - 3);
      y--
    ) {
      availableYears.push(y);
    }
    if (!availableYears.includes(selectedYear))
      availableYears.push(selectedYear);
    availableYears.sort((a, b) => b - a);

    // Bookings for selected year
    const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
    const yearEnd = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999));

    const bookings = await prisma.booking.findMany({
      where: {
        listingId: { in: scopedListingIds },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
        endDate: { gte: yearStart, lte: yearEnd },
      },
      include: bookingInclude,
      orderBy: { endDate: "asc" },
    });

    // A guest's booking currency can differ from the host's settlement
    // currency. Only expose currencies backed by immutable payout snapshots.
    const currencySet = new Set<string>();
    for (const b of bookings) {
      const currency = settlementCurrencyForBooking(b);
      if (currency) currencySet.add(currency);
    }
    for (const adjustment of allAdjustments) {
      const createdAt = new Date(adjustment.createdAt);
      if (
        adjustment.status === "DEDUCTED" &&
        createdAt >= yearStart &&
        createdAt <= yearEnd
      ) {
        currencySet.add(adjustment.currency.toUpperCase());
      }
    }
    const currencies = Array.from(currencySet).sort();
    const defaultCurrency = currencies.includes("SAR")
      ? "SAR"
      : currencies[0] || "SAR";
    const requestedCurrency = query.currency?.trim().toUpperCase();
    if (requestedCurrency && !currencies.includes(requestedCurrency)) {
      throw AppError.badRequest(
        "Currency is not available in this reporting scope.",
      );
    }
    const selectedCurrency = requestedCurrency || defaultCurrency;

    // Build monthly reports (1..12)
    const monthlyReports: MonthlyReportCard[] = [];
    let yearlyGross = 0;
    let yearlyAdjustments = 0;
    let yearlyFee = 0;
    let yearlyTaxes = 0;
    let yearlyNet = 0;
    let yearlyPaid = 0;
    let yearlyUpcoming = 0;
    let yearlyTxCount = 0;

    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(Date.UTC(selectedYear, m, 1));
      const monthEnd = new Date(
        Date.UTC(selectedYear, m + 1, 0, 23, 59, 59, 999),
      );
      const monthName = new Intl.DateTimeFormat("en-US", {
        month: "long",
        timeZone: "UTC",
      }).format(monthStart);
      const label = `${monthName} ${selectedYear}`;

      let mGross = 0;
      let mFee = 0;
      let mTaxes = 0;
      let mNet = 0;
      let mPaid = 0;
      let mUpcoming = 0;
      let mCount = 0;

      // Filter bookings recognized in this month
      for (const b of bookings) {
        if (b.endDate < monthStart || b.endDate > monthEnd) continue;
        const calc = calculateBookingPayout(b, {
          now,
          hostPayoutMethods: payoutMethods,
        });
        if (!calc.hasStoredSnapshot) continue;
        if (selectedCurrency && calc.currency !== selectedCurrency) continue;

        // The reports landing follows the same completed-stay recognition
        // basis as the Earnings overview. A future reservation is not income
        // merely because it already has a price snapshot.
        if (
          b.endDate > now ||
          !["PAID", "ELIGIBLE_SETTLEMENT"].includes(calc.status)
        )
          continue;

        const stored = extractStoredHostPayout(b);
        mGross += calc.grossEarnings;
        mFee += calc.platformFee;
        mTaxes += stored?.taxesCollectedForHost ?? 0;
        mNet += calc.netPayout;
        mCount++;

        if (calc.status === "PAID") {
          mPaid += calc.netPayout;
        } else if (
          ["SCHEDULED", "PROCESSING", "ELIGIBLE_SETTLEMENT"].includes(
            calc.status,
          )
        ) {
          mUpcoming += calc.netPayout;
        }
      }

      // Monthly adjustments
      let mAdj = 0;
      for (const adj of allAdjustments) {
        const createdAt = new Date(adj.createdAt);
        if (
          adj.status !== "DEDUCTED" ||
          createdAt < monthStart ||
          createdAt > monthEnd
        )
          continue;
        if (selectedCurrency && adj.currency !== selectedCurrency) continue;
        mAdj += positiveAdjustmentAmount(adj);
      }

      const totalMonthlyNet = mNet + mAdj;

      // Status calculation
      let status: "COMPLETED" | "IN_PROGRESS" | "NO_ACTIVITY" = "NO_ACTIVITY";
      const isCurrentMonth =
        selectedYear === currentYear && m === now.getUTCMonth();
      const isPastMonth =
        selectedYear < currentYear ||
        (selectedYear === currentYear && m < now.getUTCMonth());

      if (mCount > 0 || mAdj !== 0) {
        status = isPastMonth ? "COMPLETED" : "IN_PROGRESS";
      } else if (isCurrentMonth) {
        status = "IN_PROGRESS";
      }

      monthlyReports.push({
        year: selectedYear,
        month: m + 1,
        monthName,
        label,
        dateRange: {
          start: monthStart.toISOString(),
          end: monthEnd.toISOString(),
        },
        grossEarnings: mGross,
        adjustments: mAdj,
        platformFee: mFee,
        taxesWithheld: mTaxes,
        netEarnings: totalMonthlyNet,
        paidPayouts: mPaid,
        upcomingPayouts: mUpcoming,
        currency: selectedCurrency,
        status,
        transactionCount: mCount,
      });

      yearlyGross += mGross;
      yearlyAdjustments += mAdj;
      yearlyFee += mFee;
      yearlyTaxes += mTaxes;
      yearlyNet += totalMonthlyNet;
      yearlyPaid += mPaid;
      yearlyUpcoming += mUpcoming;
      yearlyTxCount += mCount;
    }

    return {
      selectedYear,
      availableYears,
      selectedListingId,
      selectedCurrency,
      listings,
      currencies,
      yearlySummary: {
        grossEarnings: yearlyGross,
        adjustments: yearlyAdjustments,
        platformFee: yearlyFee,
        taxesWithheld: yearlyTaxes,
        netEarnings: yearlyNet,
        paidPayouts: yearlyPaid,
        upcomingPayouts: yearlyUpcoming,
        currency: selectedCurrency,
        transactionCount: yearlyTxCount,
      },
      monthlyReports,
    };
  },

  /**
   * Generates the detailed Monthly Earnings Report.
   */
  async getMonthlyReport(
    hostId: string,
    year: number,
    month: number,
    query: { listingId?: string; currency?: string } = {},
  ): Promise<HostMonthlyEarningsReportData> {
    const user = await prisma.user.findUnique({
      where: { id: hostId },
      select: { personalInfo: true },
    });
    if (!user) throw AppError.notFound(`Host ${hostId} not found.`);

    const info = (user.personalInfo as Record<string, any>) || {};
    const payoutMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
      ? info.payoutMethods
      : [];
    const allAdjustments: PayoutAdjustmentRecord[] = Array.isArray(
      info.payoutAdjustments,
    )
      ? info.payoutAdjustments
      : [];

    const listings = await prisma.listing.findMany({
      where: { hostId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });
    const selectedListingId = resolveOwnedListingId(listings, query.listingId);
    const scopedListingIds = selectedListingId
      ? [selectedListingId]
      : listings.map((l: { id: string }) => l.id);

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const monthName = new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: "UTC",
    }).format(monthStart);
    const monthLabel = `${monthName} ${year}`;
    const now = new Date();

    const bookings = await prisma.booking.findMany({
      where: {
        listingId: { in: scopedListingIds },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
        endDate: { gte: monthStart, lte: monthEnd },
      },
      include: bookingInclude,
      orderBy: { endDate: "desc" },
    });
    const currencySet = new Set<string>();
    for (const b of bookings) {
      const currency = settlementCurrencyForBooking(b);
      if (currency) currencySet.add(currency);
    }
    for (const adjustment of allAdjustments) {
      const createdAt = new Date(adjustment.createdAt);
      if (
        adjustment.status === "DEDUCTED" &&
        createdAt >= monthStart &&
        createdAt <= monthEnd
      ) {
        currencySet.add(adjustment.currency.toUpperCase());
      }
    }
    const currencies = Array.from(currencySet).sort();
    const defaultCurrency = currencies.includes("SAR")
      ? "SAR"
      : currencies[0] || "SAR";
    const requestedCurrency = query.currency?.trim().toUpperCase();
    if (requestedCurrency && !currencies.includes(requestedCurrency)) {
      throw AppError.badRequest(
        "Currency is not available in this reporting scope.",
      );
    }
    const selectedCurrency = requestedCurrency || defaultCurrency;

    let grossEarnings = 0;
    let platformFee = 0;
    let taxesWithheld = 0;
    let netEarnings = 0;
    let paidPayouts = 0;
    let upcomingPayouts = 0;

    let accommodation = 0;
    let cleaningFee = 0;
    let extraGuestFee = 0;
    let petFee = 0;

    const propertyMap = new Map<
      string,
      {
        listingId: string;
        listingTitle: string;
        gross: number;
        deductions: number;
        net: number;
        count: number;
      }
    >();
    const transactions: HostEarningsPayoutPreview[] = [];
    const payoutStatusSummary = {
      paidVolume: 0,
      paidCount: 0,
      processingVolume: 0,
      processingCount: 0,
      scheduledVolume: 0,
      scheduledCount: 0,
    };
    const methodMap = new Map<
      string,
      { bankName: string; ibanMasked: string; amount: number; count: number }
    >();

    for (const b of bookings) {
      const calc = calculateBookingPayout(b, {
        now,
        hostPayoutMethods: payoutMethods,
      });
      if (!calc.hasStoredSnapshot) continue;
      if (selectedCurrency && calc.currency !== selectedCurrency) continue;
      if (
        b.endDate > now ||
        !["PAID", "ELIGIBLE_SETTLEMENT"].includes(calc.status)
      )
        continue;

      const stored = extractStoredHostPayout(b);
      const preview = toPayoutPreview(b, calc);
      transactions.push(preview);

      grossEarnings += calc.grossEarnings;
      platformFee += calc.platformFee;
      const bTaxes = stored?.taxesCollectedForHost ?? 0;
      taxesWithheld += bTaxes;
      netEarnings += calc.netPayout;

      if (stored) {
        accommodation += stored.accommodationSubtotal;
        cleaningFee += stored.cleaningFee;
        extraGuestFee += stored.extraGuestFee;
        petFee += stored.petFee;
      }

      // Property aggregation
      const pEntry = propertyMap.get(b.listingId) || {
        listingId: b.listingId,
        listingTitle: b.listing.title,
        gross: 0,
        deductions: 0,
        net: 0,
        count: 0,
      };
      pEntry.gross += calc.grossEarnings;
      pEntry.deductions += calc.platformFee + bTaxes;
      pEntry.net += calc.netPayout;
      pEntry.count++;
      propertyMap.set(b.listingId, pEntry);

      // Payout status breakdown
      if (calc.status === "PAID") {
        paidPayouts += calc.netPayout;
        payoutStatusSummary.paidVolume += calc.netPayout;
        payoutStatusSummary.paidCount++;

        const methodMasked =
          calc.executionDetails?.payoutMethodMasked || "Default Bank Account";
        const mKey = methodMasked;
        const mEntry = methodMap.get(mKey) || {
          bankName: "Bank Transfer",
          ibanMasked: methodMasked,
          amount: 0,
          count: 0,
        };
        mEntry.amount += calc.netPayout;
        mEntry.count++;
        methodMap.set(mKey, mEntry);
      } else if (calc.status === "PROCESSING") {
        upcomingPayouts += calc.netPayout;
        payoutStatusSummary.processingVolume += calc.netPayout;
        payoutStatusSummary.processingCount++;
      } else if (["SCHEDULED", "ELIGIBLE_SETTLEMENT"].includes(calc.status)) {
        upcomingPayouts += calc.netPayout;
        payoutStatusSummary.scheduledVolume += calc.netPayout;
        payoutStatusSummary.scheduledCount++;
      }
    }

    // Adjustments for this month
    const adjustmentsList = allAdjustments.filter((adj) => {
      const createdAt = new Date(adj.createdAt);
      return (
        adj.status === "DEDUCTED" &&
        createdAt >= monthStart &&
        createdAt <= monthEnd &&
        (!selectedCurrency || adj.currency === selectedCurrency)
      );
    });
    const adjustmentsTotal = adjustmentsList.reduce(
      (sum, adj) => sum + positiveAdjustmentAmount(adj),
      0,
    );
    const finalNet = netEarnings + adjustmentsTotal;

    const propertyBreakdown: PropertyEarningsBreakdown[] = Array.from(
      propertyMap.values(),
    ).map((p) => ({
      listingId: p.listingId,
      listingTitle: p.listingTitle,
      grossEarnings: p.gross,
      deductions: p.deductions,
      netEarnings: p.net,
      transactionsCount: p.count,
      currency: selectedCurrency,
    }));

    return {
      year,
      month,
      monthName,
      monthLabel,
      dateRange: {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      },
      selectedListingId,
      selectedCurrency,
      summary: {
        grossEarnings,
        adjustments: adjustmentsTotal,
        platformFee,
        taxesWithheld,
        netEarnings: finalNet,
        paidPayouts,
        upcomingPayouts,
        currency: selectedCurrency,
      },
      propertyBreakdown,
      earningsTypeBreakdown: {
        accommodation,
        cleaningFee,
        extraGuestFee,
        petFee,
        adjustments: adjustmentsTotal,
        currency: selectedCurrency,
      },
      payoutStatusBreakdown: {
        ...payoutStatusSummary,
        currency: selectedCurrency,
      },
      payoutMethodBreakdown: Array.from(methodMap.values()).map((m) => ({
        ...m,
        currency: selectedCurrency,
      })),
      transactions,
      adjustmentsList,
      listings,
      currencies,
    };
  },

  /**
   * Generates the detailed Yearly Earnings Report.
   */
  async getYearlyReport(
    hostId: string,
    year: number,
    query: { listingId?: string; currency?: string } = {},
  ): Promise<HostYearlyEarningsReportData> {
    const landing = await this.getReportsLanding(hostId, {
      year,
      listingId: query.listingId,
      currency: query.currency,
    });
    const selectedCurrency = landing.selectedCurrency || "SAR";

    // Gather property breakdown across the entire year
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const user = await prisma.user.findUnique({
      where: { id: hostId },
      select: { personalInfo: true },
    });
    const info = (user?.personalInfo as Record<string, any>) || {};
    const payoutMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
      ? info.payoutMethods
      : [];
    const scopedListingIds = landing.selectedListingId
      ? [landing.selectedListingId]
      : landing.listings.map((l) => l.id);

    const bookings = await prisma.booking.findMany({
      where: {
        listingId: { in: scopedListingIds },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
        endDate: { gte: yearStart, lte: yearEnd },
      },
      include: bookingInclude,
      orderBy: { endDate: "desc" },
    });

    const now = new Date();
    const propertyMap = new Map<
      string,
      {
        listingId: string;
        listingTitle: string;
        gross: number;
        deductions: number;
        net: number;
        count: number;
      }
    >();
    let accommodation = 0;
    let cleaningFee = 0;
    let extraGuestFee = 0;
    let petFee = 0;
    const payoutStatusSummary = {
      paidVolume: 0,
      paidCount: 0,
      processingVolume: 0,
      processingCount: 0,
      scheduledVolume: 0,
      scheduledCount: 0,
    };
    const methodMap = new Map<
      string,
      { bankName: string; ibanMasked: string; amount: number; count: number }
    >();

    for (const b of bookings) {
      const calc = calculateBookingPayout(b, {
        now,
        hostPayoutMethods: payoutMethods,
      });
      if (!calc.hasStoredSnapshot) continue;
      if (selectedCurrency && calc.currency !== selectedCurrency) continue;

      const stored = extractStoredHostPayout(b);
      const bTaxes = stored?.taxesCollectedForHost ?? 0;

      if (stored) {
        accommodation += stored.accommodationSubtotal;
        cleaningFee += stored.cleaningFee;
        extraGuestFee += stored.extraGuestFee;
        petFee += stored.petFee;
      }

      const pEntry = propertyMap.get(b.listingId) || {
        listingId: b.listingId,
        listingTitle: b.listing.title,
        gross: 0,
        deductions: 0,
        net: 0,
        count: 0,
      };
      pEntry.gross += calc.grossEarnings;
      pEntry.deductions += calc.platformFee + bTaxes;
      pEntry.net += calc.netPayout;
      pEntry.count++;
      propertyMap.set(b.listingId, pEntry);

      if (calc.status === "PAID") {
        payoutStatusSummary.paidVolume += calc.netPayout;
        payoutStatusSummary.paidCount++;

        const methodMasked =
          calc.executionDetails?.payoutMethodMasked || "Default Bank Account";
        const mEntry = methodMap.get(methodMasked) || {
          bankName: "Bank Transfer",
          ibanMasked: methodMasked,
          amount: 0,
          count: 0,
        };
        mEntry.amount += calc.netPayout;
        mEntry.count++;
        methodMap.set(methodMasked, mEntry);
      } else if (calc.status === "PROCESSING") {
        payoutStatusSummary.processingVolume += calc.netPayout;
        payoutStatusSummary.processingCount++;
      } else if (["SCHEDULED", "ELIGIBLE_SETTLEMENT"].includes(calc.status)) {
        payoutStatusSummary.scheduledVolume += calc.netPayout;
        payoutStatusSummary.scheduledCount++;
      }
    }

    return {
      year,
      yearLabel: `${year} Annual Report`,
      dateRange: { start: yearStart.toISOString(), end: yearEnd.toISOString() },
      selectedListingId: landing.selectedListingId,
      selectedCurrency,
      summary: landing.yearlySummary,
      monthlyBreakdown: landing.monthlyReports,
      propertyBreakdown: Array.from(propertyMap.values()).map((p) => ({
        listingId: p.listingId,
        listingTitle: p.listingTitle,
        grossEarnings: p.gross,
        deductions: p.deductions,
        netEarnings: p.net,
        transactionsCount: p.count,
        currency: selectedCurrency,
      })),
      earningsTypeBreakdown: {
        accommodation,
        cleaningFee,
        extraGuestFee,
        petFee,
        adjustments: landing.yearlySummary.adjustments,
        currency: selectedCurrency,
      },
      payoutStatusBreakdown: {
        ...payoutStatusSummary,
        currency: selectedCurrency,
      },
      payoutMethodBreakdown: Array.from(methodMap.values()).map((m) => ({
        ...m,
        currency: selectedCurrency,
      })),
      listings: landing.listings,
      currencies: landing.currencies,
    };
  },

  /**
   * Resolves dataset for custom report queries and exports.
   */
  async getCustomReportDataset(hostId: string, query: CustomReportQuery) {
    const user = await prisma.user.findUnique({
      where: { id: hostId },
      select: { name: true, personalInfo: true },
    });
    if (!user) throw AppError.notFound(`Host ${hostId} not found.`);

    const info = (user.personalInfo as Record<string, any>) || {};
    const payoutMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
      ? info.payoutMethods
      : [];
    const allAdjustments: PayoutAdjustmentRecord[] = Array.isArray(
      info.payoutAdjustments,
    )
      ? info.payoutAdjustments
      : [];

    const listings = await prisma.listing.findMany({
      where: { hostId },
      select: { id: true, title: true },
    });
    const selectedListingId = resolveOwnedListingId(listings, query.listingId);
    const scopedListingIds = selectedListingId
      ? [selectedListingId]
      : listings.map((l: { id: string }) => l.id);

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    const period = query.period || "this_month";
    if (period === "this_month") {
      startDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      endDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );
    } else if (period === "last_month") {
      startDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      endDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999),
      );
    } else if (period === "this_year") {
      startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      endDate = now;
    } else if (period === "previous_year") {
      startDate = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      endDate = new Date(
        Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999),
      );
    } else if (period === "custom" && query.startDate && query.endDate) {
      startDate = new Date(`${query.startDate}T00:00:00.000Z`);
      endDate = new Date(`${query.endDate}T23:59:59.999Z`);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        startDate > endDate
      ) {
        throw AppError.badRequest("Invalid custom date range.");
      }
    } else {
      startDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      endDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );
    }

    const reportBookingWhere = {
      listingId: { in: scopedListingIds },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
      endDate: { gte: startDate, lte: endDate },
    };
    const matchingBookingCount = await prisma.booking.count({
      where: reportBookingWhere,
    });
    if (matchingBookingCount > MAX_REPORT_BOOKINGS) {
      throw AppError.badRequest(
        `This report contains more than ${MAX_REPORT_BOOKINGS.toLocaleString()} reservations. Narrow the date range or property filter before exporting.`,
      );
    }
    const bookings = await prisma.booking.findMany({
      where: reportBookingWhere,
      include: bookingInclude,
      orderBy: { endDate: "desc" },
    });

    const adjustmentCandidates = allAdjustments.filter((adjustment) => {
      const createdAt = new Date(adjustment.createdAt);
      return (
        adjustment.status === "DEDUCTED" &&
        createdAt >= startDate &&
        createdAt <= endDate
      );
    });
    const requestedCurrency = query.currency?.trim().toUpperCase();
    if (requestedCurrency && !/^[A-Z]{3}$/.test(requestedCurrency)) {
      throw AppError.badRequest("Currency must be a three-letter ISO code.");
    }
    const reportCurrencies = new Set<string>();
    if (query.earningsType !== "adjustments") {
      for (const booking of bookings) {
        const currency = settlementCurrencyForBooking(booking);
        if (currency) reportCurrencies.add(currency);
      }
    }
    if (query.earningsType !== "reservation") {
      for (const adjustment of adjustmentCandidates)
        reportCurrencies.add(adjustment.currency.toUpperCase());
    }
    if (!requestedCurrency && reportCurrencies.size > 1) {
      throw AppError.badRequest(
        "Select one currency before generating a multi-currency report.",
      );
    }
    const resolvedCurrency =
      requestedCurrency || Array.from(reportCurrencies)[0] || "SAR";

    const rows: Array<{
      bookingId: string;
      listingTitle: string;
      guestName: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      status: string;
      currency: string;
      accommodation: number;
      cleaningFee: number;
      extraGuestFee: number;
      petFee: number;
      grossEarnings: number;
      hostServiceFee: number;
      adjustments: number;
      taxesWithheld: number;
      netEarnings: number;
      payoutReference: string;
      payoutStatus: string;
      payoutMethod: string;
      scheduledPayoutDate: string;
      actualPayoutDate: string;
      payoutAmount: number;
    }> = [];

    let totalGross = 0;
    let totalFee = 0;
    let totalTaxes = 0;
    let totalNet = 0;
    let totalPaid = 0;
    let totalUpcoming = 0;
    if (query.earningsType !== "adjustments") {
      for (const b of bookings) {
        const calc = calculateBookingPayout(b, {
          now,
          hostPayoutMethods: payoutMethods,
        });
        if (!calc.hasStoredSnapshot) continue;
        if (calc.currency !== resolvedCurrency) continue;

        // Payout status filter
        if (query.payoutStatus === "paid" && calc.status !== "PAID") continue;
        if (
          query.payoutStatus === "upcoming" &&
          !["SCHEDULED", "PROCESSING", "ELIGIBLE_SETTLEMENT"].includes(
            calc.status,
          )
        )
          continue;

        // Payout method filter
        const methodMasked = calc.executionDetails?.payoutMethodMasked || "";
        if (
          query.payoutMethodMasked &&
          !methodMasked.includes(query.payoutMethodMasked)
        )
          continue;

        const stored = extractStoredHostPayout(b);
        const nights = Math.max(
          0,
          Math.round((b.endDate.getTime() - b.startDate.getTime()) / 86400000),
        );
        const bTaxes = stored?.taxesCollectedForHost ?? 0;

        totalGross += calc.grossEarnings;
        totalFee += calc.platformFee;
        totalTaxes += bTaxes;
        totalNet += calc.netPayout;

        if (calc.status === "PAID") {
          totalPaid += calc.netPayout;
        } else {
          totalUpcoming += calc.netPayout;
        }

        rows.push({
          bookingId: b.id,
          listingTitle: b.listing.title,
          guestName: b.user?.name || "Guest",
          checkIn: b.startDate.toISOString().slice(0, 10),
          checkOut: b.endDate.toISOString().slice(0, 10),
          nights,
          status: b.status,
          currency: calc.currency,
          accommodation: stored?.accommodationSubtotal ?? 0,
          cleaningFee: stored?.cleaningFee ?? 0,
          extraGuestFee: stored?.extraGuestFee ?? 0,
          petFee: stored?.petFee ?? 0,
          grossEarnings: calc.grossEarnings,
          hostServiceFee: calc.platformFee,
          adjustments: 0,
          taxesWithheld: bTaxes,
          netEarnings: calc.netPayout,
          payoutReference: calc.executionDetails?.settlementReference || "",
          payoutStatus: calc.status,
          payoutMethod: methodMasked || "Default Bank",
          scheduledPayoutDate: calc.scheduledPayoutDate
            .toISOString()
            .slice(0, 10),
          actualPayoutDate: calc.executionDetails?.executedAt
            ? calc.executionDetails.executedAt.slice(0, 10)
            : "",
          payoutAmount: calc.netPayout,
        });
      }
    }

    // Adjustments if included
    let totalAdjustments = 0;
    if (query.earningsType !== "reservation") {
      for (const adj of adjustmentCandidates) {
        const createdAt = new Date(adj.createdAt);
        if (adj.currency.toUpperCase() !== resolvedCurrency) continue;

        const adjVal = positiveAdjustmentAmount(adj);
        totalAdjustments += adjVal;
        totalNet += adjVal;

        if (query.earningsType === "adjustments") {
          rows.push({
            bookingId: adj.bookingId || adj.id,
            listingTitle: "Account Adjustment",
            guestName: "Host Resolution",
            checkIn: createdAt.toISOString().slice(0, 10),
            checkOut: createdAt.toISOString().slice(0, 10),
            nights: 0,
            status: adj.status,
            currency: adj.currency,
            accommodation: 0,
            cleaningFee: 0,
            extraGuestFee: 0,
            petFee: 0,
            grossEarnings: 0,
            hostServiceFee: 0,
            adjustments: adjVal,
            taxesWithheld: 0,
            netEarnings: adjVal,
            payoutReference: adj.id,
            payoutStatus: "ADJUSTMENT",
            payoutMethod: "Balance deduction",
            scheduledPayoutDate: createdAt.toISOString().slice(0, 10),
            actualPayoutDate: adj.deductedAt
              ? adj.deductedAt.slice(0, 10)
              : createdAt.toISOString().slice(0, 10),
            payoutAmount: adjVal,
          });
        }
      }
    }

    return {
      hostName: user.name || "Host",
      periodLabel: `${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
      currency: resolvedCurrency,
      summary: {
        grossEarnings: totalGross,
        adjustments: totalAdjustments,
        platformFee: totalFee,
        taxesWithheld: totalTaxes,
        netEarnings: totalNet,
        paidPayouts: totalPaid,
        upcomingPayouts: totalUpcoming,
        transactionCount: rows.length,
      },
      rows,
    };
  },

  /**
   * Generates sanitized RFC-4180 CSV export.
   */
  async exportCsv(
    hostId: string,
    query: CustomReportQuery,
  ): Promise<{ csv: string; filename: string }> {
    const dataset = await this.getCustomReportDataset(hostId, query);
    const selectedFields =
      query.fields && query.fields.length > 0
        ? query.fields
        : defaultExportFields;

    type ReportRow = (typeof dataset.rows)[number];
    const columnDefs: Record<
      string,
      { label: string; get: (row: ReportRow) => string }
    > = {
      bookingId: { label: "Booking Reference", get: (r) => r.bookingId },
      listingTitle: { label: "Property Title", get: (r) => r.listingTitle },
      guestName: { label: "Guest Name", get: (r) => r.guestName },
      checkIn: { label: "Check-in Date", get: (r) => r.checkIn },
      checkOut: { label: "Check-out Date", get: (r) => r.checkOut },
      nights: { label: "Nights", get: (r) => String(r.nights) },
      status: { label: "Booking Status", get: (r) => r.status },
      currency: { label: "Currency", get: (r) => r.currency },
      accommodation: {
        label: "Accommodation Subtotal",
        get: (r) => (r.accommodation / 100).toFixed(2),
      },
      cleaningFee: {
        label: "Cleaning Fee",
        get: (r) => (r.cleaningFee / 100).toFixed(2),
      },
      extraGuestFee: {
        label: "Additional Guest Fee",
        get: (r) => (r.extraGuestFee / 100).toFixed(2),
      },
      petFee: { label: "Pet Fee", get: (r) => (r.petFee / 100).toFixed(2) },
      grossEarnings: {
        label: "Gross Earnings",
        get: (r) => (r.grossEarnings / 100).toFixed(2),
      },
      hostServiceFee: {
        label: "Host Service Fee",
        get: (r) => `-${(r.hostServiceFee / 100).toFixed(2)}`,
      },
      adjustments: {
        label: "Adjustments",
        get: (r) => (r.adjustments / 100).toFixed(2),
      },
      taxesWithheld: {
        label: "Taxes Withheld",
        get: (r) => (r.taxesWithheld / 100).toFixed(2),
      },
      netEarnings: {
        label: "Net Earnings",
        get: (r) => (r.netEarnings / 100).toFixed(2),
      },
      payoutReference: {
        label: "Payout Reference",
        get: (r) => r.payoutReference,
      },
      payoutStatus: { label: "Payout Status", get: (r) => r.payoutStatus },
      payoutMethod: { label: "Payout Method", get: (r) => r.payoutMethod },
      scheduledPayoutDate: {
        label: "Scheduled Payout Date",
        get: (r) => r.scheduledPayoutDate,
      },
      actualPayoutDate: {
        label: "Actual Payout Date",
        get: (r) => r.actualPayoutDate,
      },
      payoutAmount: {
        label: "Payout Amount",
        get: (r) => (r.payoutAmount / 100).toFixed(2),
      },
    };

    const validFieldKeys = selectedFields.filter((key) => key in columnDefs);
    const headers = validFieldKeys.map((key) =>
      sanitizeCsv(columnDefs[key].label),
    );

    // Summary metadata header
    const metadataLines = [
      `# Homyz Host Earnings Report`,
      `# Period: ${dataset.periodLabel}`,
      `# Currency: ${dataset.currency}`,
      `# Total Gross Earnings: ${(dataset.summary.grossEarnings / 100).toFixed(2)}`,
      `# Total Host Service Fee: -${(dataset.summary.platformFee / 100).toFixed(2)}`,
      `# Total Net Earnings: ${(dataset.summary.netEarnings / 100).toFixed(2)}`,
      `# Total Paid Payouts: ${(dataset.summary.paidPayouts / 100).toFixed(2)}`,
      `# Total Upcoming Payouts: ${(dataset.summary.upcomingPayouts / 100).toFixed(2)}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
    ];

    const dataRows = dataset.rows.map((row) =>
      validFieldKeys
        .map((key) => sanitizeCsv(columnDefs[key].get(row)))
        .join(","),
    );

    const csvContent = `\uFEFF${[...metadataLines, headers.join(","), ...dataRows].join("\n")}`;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `homyz-earnings-report-${dateStamp}.csv`;

    return { csv: csvContent, filename };
  },

  /**
   * Generates professional downloadable PDF report.
   */
  async exportPdf(
    hostId: string,
    query: CustomReportQuery,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const dataset = await this.getCustomReportDataset(hostId, query);
    const moneyStr = (cents: number) =>
      `${dataset.currency} ${(cents / 100).toFixed(2)}`;

    const doc = new SimplePdfDocument({
      title: "Host Earnings Report",
      subtitle: "Earnings report — not a tax statement",
      periodLabel: dataset.periodLabel,
      currency: dataset.currency,
      hostName: dataset.hostName,
      generatedAt: new Date().toISOString(),
    });

    doc.addHeader();
    doc.addSectionTitle("Financial Overview");
    doc.addSummaryGrid([
      {
        label: "Gross Earnings",
        value: moneyStr(dataset.summary.grossEarnings),
      },
      {
        label: "Host Service Fee",
        value: `-${moneyStr(dataset.summary.platformFee)}`,
      },
      { label: "Adjustments", value: moneyStr(dataset.summary.adjustments) },
      {
        label: "Net Earnings",
        value: moneyStr(dataset.summary.netEarnings),
        isHighlight: true,
      },
      {
        label: "Paid Disbursements",
        value: moneyStr(dataset.summary.paidPayouts),
      },
      {
        label: "Upcoming Payouts",
        value: moneyStr(dataset.summary.upcomingPayouts),
      },
      {
        label: "Total Bookings",
        value: String(dataset.summary.transactionCount),
      },
    ]);

    doc.addSectionTitle("Transactions Detail");
    if (dataset.rows.length === 0) {
      doc.addCallout(
        "No transaction records found matching the selected reporting period and filters.",
      );
    } else {
      doc.addTable(
        [
          { header: "Booking Reference", key: "bookingId", width: 95 },
          { header: "Property", key: "listingTitle", width: 115 },
          { header: "Guest", key: "guestName", width: 85 },
          { header: "Dates", key: "stayDates", width: 80 },
          { header: "Gross", key: "grossFormatted", width: 70, align: "right" },
          {
            header: "Net Payout",
            key: "netFormatted",
            width: 70,
            align: "right",
          },
        ],
        dataset.rows.map((r) => ({
          bookingId: r.bookingId,
          listingTitle: r.listingTitle,
          guestName: r.guestName,
          stayDates: `${r.checkIn.slice(5)} to ${r.checkOut.slice(5)}`,
          grossFormatted: `${(r.grossEarnings / 100).toFixed(2)}`,
          netFormatted: `${(r.netEarnings / 100).toFixed(2)}`,
        })),
      );
    }

    const buffer = doc.toBuffer();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `homyz-earnings-report-${dateStamp}.pdf`;
    return { buffer, filename };
  },
};

export { defaultExportFields, DEFAULT_EXPORT_FIELDS };
