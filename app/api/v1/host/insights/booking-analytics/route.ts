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
  const propertyLimitValue = url.searchParams.get("propertyLimit");
  const propertyLimit = propertyLimitValue === "all"
    ? null
    : propertyLimitValue && /^\d+$/.test(propertyLimitValue)
      ? Math.min(100, Number(propertyLimitValue))
      : undefined;
  const response = ok(await hostBookingAnalyticsService.getOverview(actor, {
    listingId: filters.listingId,
    period: filters.period,
    startDate: filters.startDate,
    endDate: filters.endDate,
    ...comparison,
    propertyLimit,
    currency: filters.currency || req.cookies.get("homyz_display_currency")?.value || "SAR",
  }));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
