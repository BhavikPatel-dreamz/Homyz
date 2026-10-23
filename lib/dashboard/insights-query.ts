import { AppError } from "@/lib/api/errors";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

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
