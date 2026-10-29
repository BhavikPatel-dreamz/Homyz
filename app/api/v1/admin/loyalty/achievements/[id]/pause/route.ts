import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminAchievementService } from "@/services/admin-achievement.service";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE);
  const body = await req.json().catch(() => ({})) as { paused?: boolean };
  return ok(await adminAchievementService.setAdminAchievementDefinitionPaused(actor, (await params).id, body.paused !== false));
});
