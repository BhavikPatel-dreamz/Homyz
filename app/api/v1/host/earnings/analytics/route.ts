import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostEarningsAnalyticsService } from "@/services/host-earnings-analytics.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";
import { AppError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const filters = parseInsightsReportingFilters(new URL(req.url));
  const url = new URL(req.url);
  const comparisonStartDate = url.searchParams.get("comparisonStartDate") || undefined;
  const comparisonEndDate = url.searchParams.get("comparisonEndDate") || undefined;
  const validDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()));
  if ((comparisonStartDate || comparisonEndDate) && (!validDate(comparisonStartDate) || !validDate(comparisonEndDate) || comparisonStartDate! > comparisonEndDate!)) {
    throw AppError.badRequest("A comparison period requires a valid start and end date.");
  }
  const currency = filters.currency || req.cookies.get("homyz_display_currency")?.value || "SAR";
  return ok(await hostEarningsAnalyticsService.getOverview(actor, {
    listingId: filters.listingId,
    period: filters.period,
    startDate: filters.startDate,
    endDate: filters.endDate,
    comparisonStartDate,
    comparisonEndDate,
    currency,
  }));
});
