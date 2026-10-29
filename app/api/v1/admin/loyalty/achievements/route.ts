import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminAchievementService } from "@/services/admin-achievement.service";

// GET /api/v1/admin/loyalty/achievements — authenticated definition catalog search.
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_VIEW);
  const query = new URL(req.url).searchParams;
  return ok(await adminAchievementService.listAdminAchievementDefinitions({
    search: query.get("search") || undefined,
    status: (query.get("status") as "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED" | "ALL" | null) ?? undefined,
    category: query.get("category") || undefined,
    page: query.get("page") ? Number(query.get("page")) : undefined,
    limit: query.get("limit") ? Number(query.get("limit")) : undefined,
  }));
});

// POST /api/v1/admin/loyalty/achievements — creates a disabled draft only.
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE);
  return created(await adminAchievementService.createAdminAchievementDefinition(actor, await req.json()));
});
