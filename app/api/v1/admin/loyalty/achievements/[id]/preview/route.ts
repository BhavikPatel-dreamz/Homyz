import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminAchievementService } from "@/services/admin-achievement.service";

// This endpoint is deliberately read-only. It evaluates existing evidence and cannot award.
export const POST = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_VIEW);
  const body = await req.json();
  if (typeof body.userId !== "string" || !body.userId) throw AppError.validation("userId is required.");
  return ok(await adminAchievementService.previewAdminAchievementEligibility((await params).id, body.userId));
});
