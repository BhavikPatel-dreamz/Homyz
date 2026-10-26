import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";
import { hostBookingAnalyticsService } from "@/services/host-booking-analytics.service";
import { requireHostDashboardFeature } from "@/lib/entitlements/host-dashboard";

export const dynamic = "force-dynamic";

function comparisonFilters(url: URL) {
  const comparisonStartDate = url.searchParams.get("comparisonStartDate") || undefined;
  const comparisonEndDate = url.searchParams.get("comparisonEndDate") || undefined;
  const validDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()));
  if ((comparisonStartDate || comparisonEndDate) && (!validDate(comparisonStartDate) || !validDate(comparisonEndDate) || comparisonStartDate! > comparisonEndDate!)) {
    throw AppError.badRequest("A comparison period requires a valid start and end date.");
  }
  return { comparisonStartDate, comparisonEndDate };
}

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "BOOKING_BEHAVIOR");
  const url = new URL(req.url);
  const filters = parseInsightsReportingFilters(url);
  const comparison = comparisonFilters(url);
  const propertyPage = Number(url.searchParams.get("propertyPage") || "1");
  const propertyPageSize = Number(url.searchParams.get("propertyPageSize") || "10");
  const propertySort = url.searchParams.get("propertySort");
  if (!Number.isInteger(propertyPage) || propertyPage < 1 || !Number.isInteger(propertyPageSize) || ![10, 25, 50].includes(propertyPageSize)) {
    throw AppError.badRequest("Property comparison pagination is invalid.");
  }
  if (propertySort && !["bookings", "occupancy", "rate", "revenue", "cancellation"].includes(propertySort)) {
    throw AppError.badRequest("Property comparison sort is invalid.");
  }
  const response = ok(await hostBookingAnalyticsService.getOverview(actor, {
    listingId: filters.listingId,
    period: filters.period,
    startDate: filters.startDate,
    endDate: filters.endDate,
    ...comparison,
    propertyPage,
    propertyPageSize,
    propertySearch: url.searchParams.get("propertySearch") || undefined,
    propertySort: (propertySort ?? undefined) as "bookings" | "occupancy" | "rate" | "revenue" | "cancellation" | undefined,
    currency: filters.currency || req.cookies.get("homyz_display_currency")?.value || "SAR",
  }));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
