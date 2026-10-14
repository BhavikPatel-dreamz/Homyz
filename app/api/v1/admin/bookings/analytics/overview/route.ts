import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { analyticsAdminService, type AnalyticsFilterQuery } from "@/services/analytics-admin.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const result = await analyticsAdminService.getBookingAnalyticsOverview(actor, {
    period: (searchParams.get("period") as AnalyticsFilterQuery["period"]) || "30d",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    listingId: searchParams.get("listingId") || undefined,
    hostId: searchParams.get("hostId") || undefined,
    city: searchParams.get("city") || undefined,
    country: searchParams.get("country") || undefined,
    currency: searchParams.get("currency") || undefined,
  });

  return ok(result);
});
