/**
 * Shared Reporting Filter Foundation for Host Dashboard, Earnings, and Insights.
 * Provides unified date range presets, custom range boundaries, and comparison period derivation.
 * Uses canonical UTC date arithmetic to ensure consistency across timezones.
 */

import { bookingDateKey } from "@/lib/booking/booking-date";

export type DateRangePreset =
  | "this_month"
  | "last_month"
  | "last_30_days"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "year_to_date"
  | "custom";

export interface ReportingFilterParams {
  propertyId?: string | null;
  period?: DateRangePreset | string | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string | null;
}

export interface ResolvedReportingPeriod {
  preset: DateRangePreset;
  label: string;
  startDate: Date;
  endDate: Date;
  startDateKey: string;
  endDateKey: string;
  comparisonStartDate: Date;
  comparisonEndDate: Date;
  comparisonStartDateKey: string;
  comparisonEndDateKey: string;
  comparisonLabel: string;
  durationDays: number;
}

/**
 * Validates and normalizes date range presets.
 */
export function normalizeDateRangePreset(preset?: string | null): DateRangePreset {
  switch (preset) {
    case "this_month":
    case "last_month":
    case "last_30_days":
    case "last_3_months":
    case "last_6_months":
    case "last_12_months":
    case "year_to_date":
    case "custom":
      return preset;
    default:
      return "this_month";
  }
}

/**
 * Derives exact start, end, and comparison date boundaries for a given reporting filter.
 * Ensures consistent handling across backend aggregation services and frontend UI components.
 */
export function resolveReportingPeriod(
  params: ReportingFilterParams,
  referenceDate: Date = new Date(),
): ResolvedReportingPeriod {
  const now = referenceDate;
  const preset = normalizeDateRangePreset(params.period);
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth();
  const curDate = now.getUTCDate();

  if (preset === "last_month") {
    const startDate = new Date(Date.UTC(curYear, curMonth - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(curYear, curMonth, 0, 23, 59, 59, 999));
    const compStart = new Date(Date.UTC(curYear, curMonth - 2, 1, 0, 0, 0, 0));
    const compEnd = new Date(Date.UTC(curYear, curMonth - 1, 0, 23, 59, 59, 999));

    const monthLabel = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      preset: "last_month",
      label: monthLabel,
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate: compStart,
      comparisonEndDate: compEnd,
      comparisonStartDateKey: bookingDateKey(compStart),
      comparisonEndDateKey: bookingDateKey(compEnd),
      comparisonLabel: "vs prior month",
      durationDays,
    };
  }

  if (preset === "last_30_days") {
    const endDate = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
    const startDate = new Date(Date.UTC(curYear, curMonth, curDate - 29, 0, 0, 0, 0));

    const compEnd = new Date(Date.UTC(curYear, curMonth, curDate - 30, 23, 59, 59, 999));
    const compStart = new Date(Date.UTC(curYear, curMonth, curDate - 59, 0, 0, 0, 0));

    return {
      preset: "last_30_days",
      label: "Last 30 Days",
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate: compStart,
      comparisonEndDate: compEnd,
      comparisonStartDateKey: bookingDateKey(compStart),
      comparisonEndDateKey: bookingDateKey(compEnd),
      comparisonLabel: "vs prior 30 days",
      durationDays: 30,
    };
  }

  if (preset === "last_3_months" || preset === "last_6_months" || preset === "last_12_months") {
    const months = preset === "last_3_months" ? 3 : preset === "last_6_months" ? 6 : 12;
    const endDate = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));
    const startDate = new Date(Date.UTC(curYear, curMonth - (months - 1), 1, 0, 0, 0, 0));
    const durationDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const comparisonEndDate = new Date(startDate.getTime() - 1);
    const comparisonStartDate = new Date(Date.UTC(
      comparisonEndDate.getUTCFullYear(),
      comparisonEndDate.getUTCMonth() - (months - 1),
      1,
      0,
      0,
      0,
      0,
    ));

    return {
      preset,
      label: `Last ${months} Months`,
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate,
      comparisonEndDate,
      comparisonStartDateKey: bookingDateKey(comparisonStartDate),
      comparisonEndDateKey: bookingDateKey(comparisonEndDate),
      comparisonLabel: `vs prior ${months} months`,
      durationDays,
    };
  }

  if (preset === "year_to_date") {
    const startDate = new Date(Date.UTC(curYear, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));

    const compStart = new Date(Date.UTC(curYear - 1, 0, 1, 0, 0, 0, 0));
    const compEnd = new Date(Date.UTC(curYear - 1, curMonth, curDate, 23, 59, 59, 999));

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      preset: "year_to_date",
      label: `Year to Date (${curYear})`,
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate: compStart,
      comparisonEndDate: compEnd,
      comparisonStartDateKey: bookingDateKey(compStart),
      comparisonEndDateKey: bookingDateKey(compEnd),
      comparisonLabel: `vs same period ${curYear - 1}`,
      durationDays,
    };
  }

  if (preset === "custom" && params.startDate && params.endDate) {
    const [sY, sM, sD] = params.startDate.split("-").map(Number);
    const [eY, eM, eD] = params.endDate.split("-").map(Number);

    if (sY && sM && sD && eY && eM && eD) {
      const sDate = new Date(Date.UTC(sY, sM - 1, sD, 0, 0, 0, 0));
      const eDate = new Date(Date.UTC(eY, eM - 1, eD, 23, 59, 59, 999));

      if (sDate <= eDate) {
        const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
        const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        const compEnd = new Date(Date.UTC(sY, sM - 1, sD - 1, 23, 59, 59, 999));
        const compStart = new Date(Date.UTC(sY, sM - 1, sD - durationDays, 0, 0, 0, 0));

        return {
          preset: "custom",
          label: `${params.startDate} – ${params.endDate}`,
          startDate: sDate,
          endDate: eDate,
          startDateKey: bookingDateKey(sDate),
          endDateKey: bookingDateKey(eDate),
          comparisonStartDate: compStart,
          comparisonEndDate: compEnd,
          comparisonStartDateKey: bookingDateKey(compStart),
          comparisonEndDateKey: bookingDateKey(compEnd),
          comparisonLabel: "vs prior period",
          durationDays,
        };
      }
    }
  }

  // Default: "this_month"
  const startDate = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(curYear, curMonth + 1, 0, 23, 59, 59, 999));
  const compStart = new Date(Date.UTC(curYear, curMonth - 1, 1, 0, 0, 0, 0));
  const compEnd = new Date(Date.UTC(curYear, curMonth, 0, 23, 59, 59, 999));

  const monthLabel = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    preset: "this_month",
    label: monthLabel,
    startDate,
    endDate,
    startDateKey: bookingDateKey(startDate),
    endDateKey: bookingDateKey(endDate),
    comparisonStartDate: compStart,
    comparisonEndDate: compEnd,
    comparisonStartDateKey: bookingDateKey(compStart),
    comparisonEndDateKey: bookingDateKey(compEnd),
    comparisonLabel: "vs last month",
    durationDays,
  };
}

export type TimeframeGranularity =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export interface TimeframeFilterOptions {
  timeframe?: TimeframeGranularity | string | null;
  date?: string | null;       // YYYY-MM-DD for daily
  weekStart?: string | null;  // YYYY-MM-DD for weekly (Monday)
  month?: number | null;      // 1-12
  year?: number | null;       // e.g. 2026
  quarter?: number | null;    // 1-4
  startDate?: string | null;  // YYYY-MM-DD for custom
  endDate?: string | null;    // YYYY-MM-DD for custom
}

export interface ResolvedTimeframePeriod {
  timeframe: TimeframeGranularity;
  label: string;
  startDate: Date;
  endDate: Date;
  startDateKey: string;
  endDateKey: string;
  comparisonStartDate: Date;
  comparisonEndDate: Date;
  comparisonStartDateKey: string;
  comparisonEndDateKey: string;
  comparisonLabel: string;
  durationDays: number;
}

/**
 * Resolves exact start/end dates and comparison boundaries for Daily, Weekly, Monthly,
 * Quarterly, Yearly, and Custom timeframes.
 */
export function resolveTimeframeBounds(
  options: TimeframeFilterOptions = {},
  referenceDate: Date = new Date(),
): ResolvedTimeframePeriod {
  const now = referenceDate;
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth();
  const curDate = now.getUTCDate();

  const timeframe = (
    options.timeframe === "daily" ||
    options.timeframe === "weekly" ||
    options.timeframe === "monthly" ||
    options.timeframe === "quarterly" ||
    options.timeframe === "yearly" ||
    options.timeframe === "custom"
      ? options.timeframe
      : "monthly"
  ) as TimeframeGranularity;

  if (timeframe === "daily") {
    let dayDate: Date;
    if (options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      const [y, m, d] = options.date.split("-").map(Number);
      dayDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      dayDate = new Date(Date.UTC(curYear, curMonth, curDate, 0, 0, 0, 0));
    }
    const startDate = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), 23, 59, 59, 999));

    const compStart = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate() - 1, 0, 0, 0, 0));
    const compEnd = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate() - 1, 23, 59, 59, 999));

    const dayLabel = startDate.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

    return {
      timeframe: "daily",
      label: dayLabel,
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate: compStart,
      comparisonEndDate: compEnd,
      comparisonStartDateKey: bookingDateKey(compStart),
      comparisonEndDateKey: bookingDateKey(compEnd),
      comparisonLabel: "vs yesterday",
      durationDays: 1,
    };
  }

  if (timeframe === "weekly") {
    let anchor: Date;
    if (options.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(options.weekStart)) {
      const [y, m, d] = options.weekStart.split("-").map(Number);
      anchor = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else if (options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      const [y, m, d] = options.date.split("-").map(Number);
      anchor = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      anchor = new Date(Date.UTC(curYear, curMonth, curDate, 0, 0, 0, 0));
    }
    // Monday = 0, Sunday = 6
    const dayOfWeek = (anchor.getUTCDay() + 6) % 7;
    const startDate = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() - dayOfWeek, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 6, 23, 59, 59, 999));

    const compStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() - 7, 0, 0, 0, 0));
    const compEnd = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() - 1, 23, 59, 59, 999));

    const startStr = startDate.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
    const endStr = endDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const weekLabel = `${startStr} – ${endStr}`;

    return {
      timeframe: "weekly",
      label: weekLabel,
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate: compStart,
      comparisonEndDate: compEnd,
      comparisonStartDateKey: bookingDateKey(compStart),
      comparisonEndDateKey: bookingDateKey(compEnd),
      comparisonLabel: "vs prior week",
      durationDays: 7,
    };
  }

  if (timeframe === "quarterly") {
    const year = Number.isInteger(options.year) && options.year! >= 2000 ? options.year! : curYear;
    const currentQ = Math.floor(curMonth / 3) + 1;
    const quarter = Number.isInteger(options.quarter) && options.quarter! >= 1 && options.quarter! <= 4
      ? options.quarter!
      : currentQ;

    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;

    const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));

    // Comparison: prior quarter (or prior year same quarter if year is different)
    const compYear = quarter === 1 ? year - 1 : year;
    const compQuarter = quarter === 1 ? 4 : quarter - 1;
    const compStartMonth = (compQuarter - 1) * 3;
    const compEndMonth = compStartMonth + 2;

    const compStart = new Date(Date.UTC(compYear, compStartMonth, 1, 0, 0, 0, 0));
    const compEnd = new Date(Date.UTC(compYear, compEndMonth + 1, 0, 23, 59, 59, 999));

    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      timeframe: "quarterly",
      label: `Q${quarter} ${year}`,
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate: compStart,
      comparisonEndDate: compEnd,
      comparisonStartDateKey: bookingDateKey(compStart),
      comparisonEndDateKey: bookingDateKey(compEnd),
      comparisonLabel: `vs Q${compQuarter} ${compYear}`,
      durationDays: diffDays,
    };
  }

  if (timeframe === "yearly") {
    const year = Number.isInteger(options.year) && options.year! >= 2000 ? options.year! : curYear;
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const compStart = new Date(Date.UTC(year - 1, 0, 1, 0, 0, 0, 0));
    const compEnd = new Date(Date.UTC(year - 1, 11, 31, 23, 59, 59, 999));

    return {
      timeframe: "yearly",
      label: `${year}`,
      startDate,
      endDate,
      startDateKey: bookingDateKey(startDate),
      endDateKey: bookingDateKey(endDate),
      comparisonStartDate: compStart,
      comparisonEndDate: compEnd,
      comparisonStartDateKey: bookingDateKey(compStart),
      comparisonEndDateKey: bookingDateKey(compEnd),
      comparisonLabel: `vs ${year - 1}`,
      durationDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  if (timeframe === "custom" && options.startDate && options.endDate) {
    const [sY, sM, sD] = options.startDate.split("-").map(Number);
    const [eY, eM, eD] = options.endDate.split("-").map(Number);

    if (sY && sM && sD && eY && eM && eD) {
      const sDate = new Date(Date.UTC(sY, sM - 1, sD, 0, 0, 0, 0));
      const eDate = new Date(Date.UTC(eY, eM - 1, eD, 23, 59, 59, 999));

      if (sDate <= eDate) {
        const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
        const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        const compEnd = new Date(Date.UTC(sY, sM - 1, sD - 1, 23, 59, 59, 999));
        const compStart = new Date(Date.UTC(sY, sM - 1, sD - durationDays, 0, 0, 0, 0));

        const startStr = sDate.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
        const endStr = eDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

        return {
          timeframe: "custom",
          label: `${startStr} – ${endStr}`,
          startDate: sDate,
          endDate: eDate,
          startDateKey: bookingDateKey(sDate),
          endDateKey: bookingDateKey(eDate),
          comparisonStartDate: compStart,
          comparisonEndDate: compEnd,
          comparisonStartDateKey: bookingDateKey(compStart),
          comparisonEndDateKey: bookingDateKey(compEnd),
          comparisonLabel: "vs prior period",
          durationDays,
        };
      }
    }
  }

  // Default: "monthly"
  const year = Number.isInteger(options.year) && options.year! >= 2000 ? options.year! : curYear;
  const month = Number.isInteger(options.month) && options.month! >= 1 && options.month! <= 12
    ? options.month! - 1
    : curMonth;

  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Comparison: prior month
  const compStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const compEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const monthLabel = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const compMonthLabel = compStart.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

  return {
    timeframe: "monthly",
    label: monthLabel,
    startDate,
    endDate,
    startDateKey: bookingDateKey(startDate),
    endDateKey: bookingDateKey(endDate),
    comparisonStartDate: compStart,
    comparisonEndDate: compEnd,
    comparisonStartDateKey: bookingDateKey(compStart),
    comparisonEndDateKey: bookingDateKey(compEnd),
    comparisonLabel: `vs ${compMonthLabel}`,
    durationDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

/**
 * Mathematically safe delta & percentage calculation between two values.
 * Handles zero denominators without division-by-zero or NaN errors.
 */
export function calculateDelta(
  current: number,
  previous: number,
): {
  delta: number;
  deltaPercentage: number | null;
  deltaDirection: "increase" | "decrease" | "neutral";
} {
  const delta = current - previous;
  if (previous === 0) {
    if (current === 0) {
      return { delta: 0, deltaPercentage: 0, deltaDirection: "neutral" };
    }
    // Baseline is zero, percentage change is theoretically undefined or 100% when starting from zero
    return {
      delta,
      deltaPercentage: null,
      deltaDirection: current > 0 ? "increase" : "decrease",
    };
  }

  const pct = Math.round((delta / Math.abs(previous)) * 100);
  const deltaDirection = delta > 0 ? "increase" : delta < 0 ? "decrease" : "neutral";
  return {
    delta,
    deltaPercentage: pct,
    deltaDirection,
  };
}

