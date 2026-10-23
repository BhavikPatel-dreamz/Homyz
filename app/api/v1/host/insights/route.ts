import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostInsightsService, type InsightsTab } from "@/services/host-insights.service";
import { AppError } from "@/lib/api/errors";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const tab = url.searchParams.get("tab") as InsightsTab | null;
  if (tab && !["reviews", "stats", "opportunities", "superhost"].includes(tab)) {
    throw AppError.badRequest("Unsupported Insights tab.");
  }
  const filters = parseInsightsReportingFilters(url);
  const preferredCurrency = filters.currency || req.cookies.get("homyz_display_currency")?.value || "SAR";

  const data = await hostInsightsService.getInsights(actor, {
    tab: tab || undefined,
    ...filters,
    currency: preferredCurrency,
  });

  return NextResponse.json(
    { success: true, data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
