import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { analyticsAdminService, type ReportType } from "@/services/analytics-admin.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORTS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const reportType: ReportType = body.reportType || "BOOKING_REPORT";

  const csv = await analyticsAdminService.exportReportToCsv(actor, reportType, {
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
    status: body.status || undefined,
    currency: body.currency || undefined,
  });

  const filename = `homyz_${reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});

