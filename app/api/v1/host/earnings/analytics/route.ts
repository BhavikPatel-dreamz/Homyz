import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostEarningsAnalyticsService } from "@/services/host-earnings-analytics.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";
import { AppError } from "@/lib/api/errors";
import { requireHostDashboardFeature } from "@/lib/entitlements/host-dashboard";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "ADVANCED_EARNINGS");
  const filters = parseInsightsReportingFilters(new URL(req.url));
  const url = new URL(req.url);
  const comparisonStartDate = url.searchParams.get("comparisonStartDate") || undefined;
  const comparisonEndDate = url.searchParams.get("comparisonEndDate") || undefined;
  const validDate = (value: string | undefined) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if ((comparisonStartDate || comparisonEndDate) && (!validDate(comparisonStartDate) || !validDate(comparisonEndDate) || comparisonStartDate! > comparisonEndDate!)) {
    throw AppError.badRequest("A comparison period requires a valid start and end date.");
  }
  const currency = filters.currency || req.cookies.get("homyz_display_currency")?.value || "SAR";
  const propertyPage = Number(url.searchParams.get("propertyPage") || "1");
  const propertyPageSize = Number(url.searchParams.get("propertyPageSize") || "10");
  const propertySort = url.searchParams.get("propertySort");
  const propertyStatus = url.searchParams.get("propertyStatus");
  if (!Number.isInteger(propertyPage) || propertyPage < 1 || !Number.isInteger(propertyPageSize) || ![10, 25, 50].includes(propertyPageSize)) {
    throw AppError.badRequest("Property pagination is invalid.");
  }
  if (propertySort && !["net", "gross", "revpan", "occupancy", "bookings", "nightly_rate"].includes(propertySort)) {
    throw AppError.badRequest("Property sort is invalid.");
  }
  if (propertyStatus && !["all", "with_earnings", "without_earnings"].includes(propertyStatus)) {
    throw AppError.badRequest("Property earnings filter is invalid.");
  }
  const response = ok(await hostEarningsAnalyticsService.getOverview(actor, {
    listingId: filters.listingId,
    period: filters.period,
    startDate: filters.startDate,
    endDate: filters.endDate,
    comparisonStartDate,
    comparisonEndDate,
    currency,
    propertyPage,
    propertyPageSize,
    propertySearch: url.searchParams.get("propertySearch") || undefined,
    propertySort: (propertySort ?? undefined) as "net" | "gross" | "revpan" | "occupancy" | "bookings" | "nightly_rate" | undefined,
    propertyStatus: (propertyStatus ?? undefined) as "all" | "with_earnings" | "without_earnings" | undefined,
  }));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
