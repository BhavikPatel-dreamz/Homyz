import { apiHandler } from "@/lib/api/handler";
import { paginated } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";

// GET /api/v1/admin/moderation/cases — central moderation queue.
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_READ);
  const sp = req.nextUrl.searchParams;
  const result = await moderationService.listModerationCases(actor, {
    page: Number(sp.get("page")) || 1,
    limit: Number(sp.get("limit")) || 20,
    status: sp.get("status") as never || undefined,
    targetType: sp.get("targetType") as never || undefined,
    severity: sp.get("severity") as never || undefined,
    category: sp.get("category") || undefined,
    assigned: sp.get("assigned") as "assigned" | "unassigned" | undefined,
    attention: sp.get("attention") === "1",
    assignedModeratorId: sp.get("assignedModeratorId") || undefined,
    search: sp.get("search") || undefined,
    startDate: sp.get("startDate") || undefined,
    endDate: sp.get("endDate") || undefined,
    updatedStartDate: sp.get("updatedStartDate") || undefined,
    updatedEndDate: sp.get("updatedEndDate") || undefined,
    sort: sp.get("sort") as never || undefined,
  });
  return paginated(result.cases, result.pagination);
});
