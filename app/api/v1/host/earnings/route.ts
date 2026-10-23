import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));
  const quarter = Number(url.searchParams.get("quarter"));
  const compareMonth = Number(url.searchParams.get("compareMonth"));
  const compareYear = Number(url.searchParams.get("compareYear"));
  const compareQuarter = Number(url.searchParams.get("compareQuarter"));

  const overview = await payoutService.getHostEarningsOverview(actor.id, {
    listingId: url.searchParams.get("propertyId") || url.searchParams.get("listingId") || undefined,
    month: Number.isInteger(month) ? month : undefined,
    year: Number.isInteger(year) ? year : undefined,
    currency: url.searchParams.get("currency") || req.cookies.get("homyz_display_currency")?.value || "SAR",
    timeframe: (url.searchParams.get("timeframe") as TimeframeGranularity) || undefined,
    date: url.searchParams.get("date") || undefined,
    weekStart: url.searchParams.get("weekStart") || undefined,
    quarter: Number.isInteger(quarter) ? quarter : undefined,
    startDate: url.searchParams.get("startDate") || undefined,
    endDate: url.searchParams.get("endDate") || undefined,
    compareEnabled: url.searchParams.get("compare") === "true",
    compareTimeframe: (url.searchParams.get("compareTimeframe") as TimeframeGranularity) || undefined,
    compareStartDate: url.searchParams.get("compareStartDate") || undefined,
    compareEndDate: url.searchParams.get("compareEndDate") || undefined,
    compareMonth: Number.isInteger(compareMonth) ? compareMonth : undefined,
    compareYear: Number.isInteger(compareYear) ? compareYear : undefined,
    compareQuarter: Number.isInteger(compareQuarter) ? compareQuarter : undefined,
  });
  return ok(overview);
});
