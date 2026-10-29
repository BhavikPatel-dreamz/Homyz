import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminAchievementService } from "@/services/admin-achievement.service";

export const GET = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_VIEW);
  return ok(await adminAchievementService.getAdminAchievementDefinition((await params).id));
});

// PATCH is intentionally restricted to untouched draft definitions.
export const PATCH = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE);
  return ok(await adminAchievementService.updateAdminAchievementDefinition(actor, (await params).id, await req.json()));
});

// DELETE is an archive operation; definitions and award provenance are never deleted.
export const DELETE = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE);
  return ok(await adminAchievementService.archiveAdminAchievementDefinition(actor, (await params).id));
});
