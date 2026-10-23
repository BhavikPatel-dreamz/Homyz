import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostInsightsService } from "@/services/host-insights.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const filters = parseInsightsReportingFilters(url);

  const data = await hostInsightsService.getInsights(actor, {
    tab: "stats",
      ...filters,
  });

  return NextResponse.json({
    success: true,
    data: {
      stats: data.stats,
      selectedListingId: data.selectedListingId,
      reportingPeriod: data.reportingPeriod,
      listings: data.listings,
    },
  });
});
