import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { customReportService } from "@/services/admin-analytics/custom-report.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "saved") {
    const list = await customReportService.listSavedReports(actor);
    return ok({ savedReports: list });
  }

  // Otherwise return report preview
  const result = await customReportService.generatePreview(actor, {
    reportType: (searchParams.get("reportType") as any) || "EXECUTIVE_SUMMARY",
    period: (searchParams.get("period") as any) || "30d",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    comparisonMode: (searchParams.get("comparisonMode") as any) || "previous_period",
    city: searchParams.get("city") || undefined,
    currency: searchParams.get("currency") || "SAR",
  });

  return ok(result);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const action = body.action || "preview";

  if (action === "save") {
    const saved = await customReportService.createSavedReport(actor, {
      name: body.name,
      description: body.description,
      reportType: body.reportType,
      filters: body.filters,
      outputFormat: body.outputFormat,
      isPublic: body.isPublic,
    });
    return ok(saved);
  }

  const preview = await customReportService.generatePreview(actor, body.filters || body);
  return ok(preview);
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Report ID required" }, { status: 400 });
  }

  await customReportService.deleteSavedReport(actor, id);
  return ok({ deleted: true });
});

