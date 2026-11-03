import { AppError } from "@/lib/api/errors";
import {
  resolveTimeframeBounds,
  type DateRangePreset,
  type TimeframeGranularity,
} from "@/lib/dashboard/reporting-filter";

const periods = new Set<DateRangePreset>([
  "this_month",
  "last_month",
  "last_30_days",
  "last_3_months",
  "last_6_months",
  "last_12_months",
  "year_to_date",
  "custom",
]);

function validIsoDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()));
}

/** Validates shared Insights query filters before they reach an aggregation service. */
export function parseInsightsReportingFilters(url: URL) {
  const periodValue = url.searchParams.get("period") || undefined;
  if (periodValue && !periods.has(periodValue as DateRangePreset)) {
    throw AppError.badRequest("Unsupported Insights reporting period.");
  }
  const period = periodValue as DateRangePreset | undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  if (period === "custom") {
    if (!validIsoDate(startDate) || !validIsoDate(endDate) || startDate! > endDate!) {
      throw AppError.badRequest("A custom Insights period requires a valid start and end date.");
    }
  }

  const currency = url.searchParams.get("currency") || undefined;
  if (currency && !/^[A-Za-z]{3}$/.test(currency)) {
    throw AppError.badRequest("Currency must be a three-letter ISO code.");
  }

  return {
    listingId: url.searchParams.get("propertyId") || url.searchParams.get("listingId") || undefined,
    period,
    startDate,
    endDate,
    currency: currency?.toUpperCase(),
  };
}

/**
 * The analytics page also accepts the established host-reporting URL shape
 * (`year`, `month`, and `timeframe`). Convert it to the analytics service's
 * canonical custom range so direct links and client refreshes retain context.
 */
export function normalizeAnalyticsReportingFilters(params: URLSearchParams) {
  const period = params.get("period");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  if (period || startDate || endDate) {
    return { period: period || undefined, startDate: startDate || undefined, endDate: endDate || undefined };
  }

  const timeframe = (params.get("analyticsTimeframe") || params.get("timeframe") || "monthly") as TimeframeGranularity;
  const month = Number(params.get("month"));
  const year = Number(params.get("year"));
  const quarter = Number(params.get("quarter"));
  const bounds = resolveTimeframeBounds({
    timeframe,
    date: params.get("date") || undefined,
    weekStart: params.get("weekStart") || undefined,
    month: Number.isInteger(month) ? month : undefined,
    year: Number.isInteger(year) ? year : undefined,
    quarter: Number.isInteger(quarter) ? quarter : undefined,
  });

  return {
    period: "custom" as const,
    startDate: bounds.startDateKey,
    endDate: bounds.endDateKey,
  };
}
