import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { exportModerationAnalyticsCsv, AnalyticsPeriod } from "@/services/moderation-analytics.service";
import { prisma } from "@/lib/db/prisma";

// GET /api/v1/admin/moderation/analytics/export — Privileged CSV export of moderation analytics
export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiPermission(req, PERMISSIONS.REPORTS_EXPORT);
    const url = new URL(req.url);

    const period = (url.searchParams.get("period") || "30d") as AnalyticsPeriod;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const targetType = url.searchParams.get("targetType") || undefined;
    const status = url.searchParams.get("status") || undefined;

    const csvData = await exportModerationAnalyticsCsv(actor, {
      period,
      startDate,
      endDate,
      targetType,
      status,
    });

    // Record privileged export action in audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "MODERATION_ANALYTICS_EXPORT",
        resourceType: "MODERATION_ANALYTICS",
        resourceId: "system",
        description: `Moderation analytics exported by ${actor.email} for period ${period}`,
        metadata: { period, startDate, endDate, targetType, status },
      },
    }).catch((err: any) => console.warn("[moderation-analytics] Failed to log export audit:", err));

    const filename = `moderation-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || "Internal server error during analytics export";
    return NextResponse.json({ error: message }, { status });
  }
}

