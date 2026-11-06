import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reportExportService } from "@/services/admin-analytics/report-export.service";
import type { ReportExportFormat } from "@/services/admin-analytics/analytics-contracts";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORTS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const format: ReportExportFormat = (body.format?.toUpperCase() as ReportExportFormat) || "XLSX";

  const exportResult = await reportExportService.generateExport(
    actor,
    body.filters || body,
    format
  );

  return new NextResponse(exportResult.data, {
    status: 200,
    headers: {
      "Content-Type": exportResult.contentType,
      "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
      "Cache-Control": "no-store, must-revalidate",
    },
  });
});

