import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";

export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_READ);
  return ok(await moderationService.getModerationDashboardSummary(actor, {
    startDate: req.nextUrl.searchParams.get("startDate") || undefined,
    endDate: req.nextUrl.searchParams.get("endDate") || undefined,
  }));
});
