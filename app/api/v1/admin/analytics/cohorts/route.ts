import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cohortAnalyticsService } from "@/services/admin-analytics/cohort.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const insights = await cohortAnalyticsService.getMarketplaceGrowthInsights(actor);
  return ok(insights);
});

