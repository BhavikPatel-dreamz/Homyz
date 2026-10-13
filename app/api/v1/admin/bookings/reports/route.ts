import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { analyticsAdminService, type ReportType } from "@/services/analytics-admin.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") as ReportType) || "BOOKING_REPORT";

  const result = await analyticsAdminService.generateReportData(actor, type, {
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    status: searchParams.get("status") || undefined,
    currency: searchParams.get("currency") || undefined,
    limit: Number(searchParams.get("limit")) || 50,
  });

  return ok(result);
});

