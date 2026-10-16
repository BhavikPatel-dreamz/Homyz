import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getModerationAnalytics, AnalyticsPeriod } from "@/services/moderation-analytics.service";

// GET /api/v1/admin/moderation/analytics — Comprehensive moderation analytics & KPIs
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_READ);
  const searchParams = req.nextUrl.searchParams;

  const period = (searchParams.get("period") || "30d") as AnalyticsPeriod;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const targetType = searchParams.get("targetType") || undefined;
  const status = searchParams.get("status") || undefined;
  const moderatorId = searchParams.get("moderatorId") || undefined;

  const data = await getModerationAnalytics(actor, {
    period,
    startDate,
    endDate,
    targetType,
    status,
    moderatorId,
  });

  return ok(data);
});

