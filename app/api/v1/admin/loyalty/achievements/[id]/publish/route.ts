import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminAchievementService } from "@/services/admin-achievement.service";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_PUBLISH);
  return ok(await adminAchievementService.publishAdminAchievementDefinition(actor, (await params).id));
});
