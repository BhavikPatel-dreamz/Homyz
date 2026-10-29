import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminAchievementService } from "@/services/admin-achievement.service";

// Explicit override only. Normal evaluators remain the source of automatic awards.
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_OVERRIDE);
  const body = await req.json() as { userId?: string; reason?: string };
  if (!body.userId || !body.reason) throw AppError.validation("userId and reason are required.");
  return ok(await adminAchievementService.manuallyAwardAchievement(actor, { achievementId: (await params).id, userId: body.userId, reason: body.reason }));
});
