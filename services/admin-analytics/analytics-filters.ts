import {
  bookingDateKey,
  differenceInBookingNights,
  parseBookingDate,
  shiftBookingDateKey,
} from "@/lib/booking/booking-date";
import type {
  AnalyticsFilterInput,
  ComparisonMode,
  MetricDelta,
  TimeframeContext,
} from "./analytics-contracts";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface NormalizedTimeframe {
  context: TimeframeContext;
  // UTC Date boundaries for Stay Calendar Date queries (db.Date)
  stayStartDate: Date;
  stayEndDate: Date;
  prevStayStartDate: Date;
  prevStayEndDate: Date;
  // UTC Timestamps for Transaction / Event queries (db.Timestamptz)
  transactionStart: Date;
  transactionEnd: Date;
  prevTransactionStart: Date;
  prevTransactionEnd: Date;
  durationDays: number;
  previousPeriodDays: number;
}

/**
 * Shifts a YYYY-MM-DD date key by a given number of calendar years,
 * handling leap years accurately (e.g. Feb 29 clamps to Feb 28 in non-leap years).
 */
export function shiftDateKeyByYears(dateKey: string, yearsDelta: number): string {
  const parts = dateKey.split("-").map(Number);
  const targetYear = parts[0] + yearsDelta;
  const month = parts[1];
  let day = parts[2];
  // Calculate max days in target month
  const maxDays = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  if (day > maxDays) day = maxDays;
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeAnalyticsTimeframe(
  input: AnalyticsFilterInput = {},
  now: Date = new Date()
): NormalizedTimeframe {
  const period = input.period || (input.startDate && input.endDate ? "custom" : "30d");
  const comparisonMode: ComparisonMode = input.comparisonMode || "previous_period";

  let startDateKey: string;
  let endDateKey: string;
  let prevStartDateKey: string;
  let prevEndDateKey: string;
  let label: string;
  let comparisonLabel: string;

  const todayKey = bookingDateKey(now);

  if (period === "custom" && input.startDate && input.endDate) {
    startDateKey = bookingDateKey(input.startDate);
    endDateKey = bookingDateKey(input.endDate);
    const days = Math.max(1, differenceInBookingNights(startDateKey, shiftBookingDateKey(endDateKey, 1)));
    prevStartDateKey = shiftBookingDateKey(startDateKey, -days);
    prevEndDateKey = shiftBookingDateKey(endDateKey, -days);
    label = `${startDateKey} – ${endDateKey}`;
    comparisonLabel = `vs prior ${days} days`;
  } else {
    switch (period) {
      case "today": {
        startDateKey = todayKey;
        endDateKey = todayKey;
        prevStartDateKey = shiftBookingDateKey(todayKey, -1);
        prevEndDateKey = prevStartDateKey;
        label = "Today";
        comparisonLabel = "vs yesterday";
        break;
      }
      case "yesterday": {
        const yesterdayKey = shiftBookingDateKey(todayKey, -1);
        startDateKey = yesterdayKey;
        endDateKey = yesterdayKey;
        prevStartDateKey = shiftBookingDateKey(yesterdayKey, -1);
        prevEndDateKey = prevStartDateKey;
        label = "Yesterday";
        comparisonLabel = "vs prior day";
        break;
      }
      case "7d": {
        startDateKey = shiftBookingDateKey(todayKey, -6);
        endDateKey = todayKey;
        prevStartDateKey = shiftBookingDateKey(startDateKey, -7);
        prevEndDateKey = shiftBookingDateKey(startDateKey, -1);
        label = "Last 7 days";
        comparisonLabel = "vs previous 7 days";
        break;
      }
      case "this_month": {
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        startDateKey = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        endDateKey = todayKey;
        const prevMonthDate = new Date(Date.UTC(y, m - 1, 1));
        const prevM = prevMonthDate.getUTCMonth();
        const prevY = prevMonthDate.getUTCFullYear();
        prevStartDateKey = `${prevY}-${String(prevM + 1).padStart(2, "0")}-01`;
        const dayOfMonth = now.getUTCDate();
        prevEndDateKey = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
        label = `Month to date (${MONTH_NAMES[m]} ${y})`;
        comparisonLabel = "vs same period last month";
        break;
      }
      case "last_month": {
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        const lastMonthFirst = new Date(Date.UTC(y, m - 1, 1));
        const lastMonthLast = new Date(Date.UTC(y, m, 0));
        startDateKey = bookingDateKey(lastMonthFirst);
        endDateKey = bookingDateKey(lastMonthLast);
        const twoMonthsPriorFirst = new Date(Date.UTC(y, m - 2, 1));
        const twoMonthsPriorLast = new Date(Date.UTC(y, m - 1, 0));
        prevStartDateKey = bookingDateKey(twoMonthsPriorFirst);
        prevEndDateKey = bookingDateKey(twoMonthsPriorLast);
        label = `Last month (${MONTH_NAMES[lastMonthFirst.getUTCMonth()]} ${lastMonthFirst.getUTCFullYear()})`;
        comparisonLabel = "vs prior month";
        break;
      }
      case "90d": {
        startDateKey = shiftBookingDateKey(todayKey, -89);
        endDateKey = todayKey;
        prevStartDateKey = shiftBookingDateKey(startDateKey, -90);
        prevEndDateKey = shiftBookingDateKey(startDateKey, -1);
        label = "Last 90 days";
        comparisonLabel = "vs previous 90 days";
        break;
      }
      case "this_year": {
        const y = now.getUTCFullYear();
        startDateKey = `${y}-01-01`;
        endDateKey = todayKey;
        prevStartDateKey = `${y - 1}-01-01`;
        prevEndDateKey = `${y - 1}-${todayKey.slice(5)}`;
        label = `Year to date (${y})`;
        comparisonLabel = `vs same period ${y - 1}`;
        break;
      }
      case "30d":
      default: {
        startDateKey = shiftBookingDateKey(todayKey, -29);
        endDateKey = todayKey;
        prevStartDateKey = shiftBookingDateKey(startDateKey, -30);
        prevEndDateKey = shiftBookingDateKey(startDateKey, -1);
        label = "Last 30 days";
        comparisonLabel = "vs previous 30 days";
        break;
      }
    }
  }

  // Override comparison baseline if mode is 'previous_year' or 'none'
  if (comparisonMode === "previous_year") {
    prevStartDateKey = shiftDateKeyByYears(startDateKey, -1);
    prevEndDateKey = shiftDateKeyByYears(endDateKey, -1);
    comparisonLabel = "vs same period last year";
  } else if (comparisonMode === "none") {
    prevStartDateKey = startDateKey;
    prevEndDateKey = endDateKey;
    comparisonLabel = "No comparison";
  }

  // Pure stay dates (PostgreSQL db.Date boundaries)
  const stayStartDate = parseBookingDate(startDateKey);
  const stayEndDate = parseBookingDate(endDateKey);
  const prevStayStartDate = parseBookingDate(prevStartDateKey);
  const prevStayEndDate = parseBookingDate(prevEndDateKey);

  // Absolute transaction timestamps (UTC 00:00:00 to 23:59:59.999)
  const transactionStart = new Date(`${startDateKey}T00:00:00.000Z`);
  const transactionEnd = new Date(`${endDateKey}T23:59:59.999Z`);
  const prevTransactionStart = new Date(`${prevStartDateKey}T00:00:00.000Z`);
  const prevTransactionEnd = new Date(`${prevEndDateKey}T23:59:59.999Z`);

  const durationDays = Math.max(1, differenceInBookingNights(startDateKey, shiftBookingDateKey(endDateKey, 1)));
  const previousPeriodDays =
    comparisonMode === "none"
      ? 0
      : Math.max(1, differenceInBookingNights(prevStartDateKey, shiftBookingDateKey(prevEndDateKey, 1)));

  const context: TimeframeContext = {
    period,
    label,
    startDateKey,
    endDateKey,
    startIso: transactionStart.toISOString(),
    endIso: transactionEnd.toISOString(),
    comparisonLabel,
    comparisonMode,
    previousStartDateKey: comparisonMode === "none" ? null : prevStartDateKey,
    previousEndDateKey: comparisonMode === "none" ? null : prevEndDateKey,
  };

  return {
    context,
    stayStartDate,
    stayEndDate,
    prevStayStartDate,
    prevStayEndDate,
    transactionStart,
    transactionEnd,
    prevTransactionStart,
    prevTransactionEnd,
    durationDays,
    previousPeriodDays,
  };
}

/**
 * Safely computes arithmetic delta and percentage change without arbitrary +100% inflation.
 * If isRateOrPercentage is true, calculates absolute percentage point change (e.g. +5.0 pp).
 * If comparisonMode is 'none', returns null percentage delta.
 */
export function calculateDelta(
  current: number,
  previous: number,
  options?: { isRateOrPercentage?: boolean; comparisonMode?: ComparisonMode }
): MetricDelta<number> {
  if (options?.comparisonMode === "none") {
    return {
      current,
      previous: null,
      absoluteChange: 0,
      percentageChange: null,
      isPositive: true,
      isPercentagePoint: options?.isRateOrPercentage ?? false,
    };
  }

  const absoluteChange = current - previous;
  let percentageChange: number | null = null;

  if (options?.isRateOrPercentage) {
    // For rates and percentages, percentageChange represents the absolute percentage point change (e.g. +5.0 pp)
    percentageChange = Math.round(absoluteChange * 10) / 10;
  } else if (previous === 0) {
    percentageChange = current === 0 ? 0 : null; // Explicitly null if baseline was 0 and current > 0
  } else {
    percentageChange = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  }

  return {
    current,
    previous,
    absoluteChange,
    percentageChange,
    isPositive: absoluteChange >= 0,
    isPercentagePoint: options?.isRateOrPercentage ?? false,
  };
}
