import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostGuestInsightsService } from "@/services/host-guest-insights.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const filters = parseInsightsReportingFilters(url);

  const data = await hostGuestInsightsService.getGuestInsightsOverview(actor, {
    propertyId: filters.listingId,
    period: filters.period,
    startDate: filters.startDate,
    endDate: filters.endDate,
    currency: filters.currency,
  });

  return NextResponse.json({
    success: true,
    data: {
      checkInEngagement: data.checkInEngagement,
      reportingPeriod: data.reportingPeriod,
      selectedListingId: data.selectedListingId,
      listings: data.listings,
    },
  });
});
