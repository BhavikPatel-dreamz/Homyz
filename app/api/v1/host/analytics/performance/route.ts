import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireAuthUser } from "@/lib/permissions/guards";
import { partnerReportingService } from "@/services/admin-analytics/partner-reporting.service";
import type { ReportExportFormat } from "@/services/admin-analytics/analytics-contracts";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireAuthUser(req);

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId") || undefined;
  const period = (searchParams.get("period") as any) || "30d";
  const currency = searchParams.get("currency") || "SAR";
  const format = searchParams.get("format") as ReportExportFormat | null;

  if (format) {
    const file = await partnerReportingService.exportPartnerReport(actor, {
      listingId,
      format,
      currency,
    });

    return new NextResponse(file.data, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const result = await partnerReportingService.getPartnerAnalytics(actor, {
    listingId,
    period,
    currency,
  });

  return ok(result);
});

