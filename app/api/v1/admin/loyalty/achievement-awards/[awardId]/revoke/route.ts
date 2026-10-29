import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminAchievementService } from "@/services/admin-achievement.service";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_OVERRIDE);
  const body = await req.json() as { reason?: string };
  if (!body.reason) throw AppError.validation("A revocation reason is required.");
  return ok(await adminAchievementService.revokeAchievementAward(actor, { awardId: (await params).awardId, reason: body.reason }));
});
