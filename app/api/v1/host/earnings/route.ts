import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";
import { AppError } from "@/lib/api/errors";

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
  const dateKey = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const compareStartDate = url.searchParams.get("compareStartDate");
  const compareEndDate = url.searchParams.get("compareEndDate");
  if ((startDate || endDate) && (!dateKey(startDate) || !dateKey(endDate) || startDate! > endDate!)) {
    throw AppError.badRequest("The reporting period requires valid start and end dates.");
  }
  if ((compareStartDate || compareEndDate) && (!dateKey(compareStartDate) || !dateKey(compareEndDate) || compareStartDate! > compareEndDate!)) {
    throw AppError.badRequest("The comparison period requires valid start and end dates.");
  }

  const overview = await payoutService.getHostEarningsOverview(actor.id, {
    listingId: url.searchParams.get("propertyId") || url.searchParams.get("listingId") || undefined,
    month: Number.isInteger(month) ? month : undefined,
    year: Number.isInteger(year) ? year : undefined,
    currency: url.searchParams.get("currency") || req.cookies.get("homyz_display_currency")?.value || "SAR",
    timeframe: (url.searchParams.get("timeframe") as TimeframeGranularity) || undefined,
    date: url.searchParams.get("date") || undefined,
    weekStart: url.searchParams.get("weekStart") || undefined,
    quarter: Number.isInteger(quarter) ? quarter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    compareEnabled: url.searchParams.get("compare") === "true",
    compareTimeframe: (url.searchParams.get("compareTimeframe") as TimeframeGranularity) || undefined,
    compareStartDate: compareStartDate || undefined,
    compareEndDate: compareEndDate || undefined,
    compareMonth: Number.isInteger(compareMonth) ? compareMonth : undefined,
    compareYear: Number.isInteger(compareYear) ? compareYear : undefined,
    compareQuarter: Number.isInteger(compareQuarter) ? compareQuarter : undefined,
    comparePreset: url.searchParams.get("comparePreset") === "prior_period" || url.searchParams.get("comparePreset") === "prior_year"
      ? url.searchParams.get("comparePreset") as "prior_period" | "prior_year"
      : undefined,
  });
  const response = ok(overview);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
