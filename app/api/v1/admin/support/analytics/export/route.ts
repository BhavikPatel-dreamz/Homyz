import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportAnalyticsService } from "@/services/support-analytics.service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, PERMISSIONS.REPORTS_EXPORT);
  const searchParams = req.nextUrl.searchParams;
  const query = Object.fromEntries(searchParams) as Parameters<typeof supportAnalyticsService.exportSupportAnalyticsCsv>[1];
  const csv = await supportAnalyticsService.exportSupportAnalyticsCsv(actor, query);
  await prisma.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_ANALYTICS_EXPORT", resourceType: "SUPPORT_ANALYTICS", resourceId: "filtered-summary", description: "Exported filtered support analytics CSV", metadata: { filters: Object.fromEntries(searchParams) } } });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="support-analytics-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
});
