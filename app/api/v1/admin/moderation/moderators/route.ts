import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";

export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_ASSIGN);
  return ok(await moderationService.listEligibleModerators(actor));
});
