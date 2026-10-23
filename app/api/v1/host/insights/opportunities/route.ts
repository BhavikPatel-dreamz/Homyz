import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostInsightsService } from "@/services/host-insights.service";
import { hostOpportunitiesService } from "@/services/host-opportunities.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const filters = parseInsightsReportingFilters(url);

  const [data, detailedOpportunities] = await Promise.all([
    hostInsightsService.getInsights(actor, {
      tab: "opportunities",
      ...filters,
    }),
    hostOpportunitiesService.getOpportunitiesOverview(actor, {
      listingId: filters.listingId,
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      opportunities: {
        ...data.opportunities,
        items: detailedOpportunities.opportunities.items,
        totalCount: detailedOpportunities.opportunities.totalCount,
        countsByCategory: detailedOpportunities.opportunities.countsByCategory,
      },
      overallHealth: detailedOpportunities.overallHealth,
      selectedListingId: data.selectedListingId,
      reportingPeriod: data.reportingPeriod,
      listings: data.listings,
    },
  });
});
