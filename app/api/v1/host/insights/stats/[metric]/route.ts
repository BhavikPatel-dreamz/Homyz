import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostStatsInsightsService } from "@/services/host-stats-insights.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ metric: string }> }) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { metric } = await ctx.params;
    const url = new URL(req.url);

    const filters = parseInsightsReportingFilters(url);
    const preferredCurrency = filters.currency || req.cookies.get("homyz_display_currency")?.value || "SAR";

    const data = await hostStatsInsightsService.getMetricDetail(actor, metric, {
      propertyId: filters.listingId,
      period: filters.period,
      startDate: filters.startDate,
      endDate: filters.endDate,
      currency: preferredCurrency,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  },
);
