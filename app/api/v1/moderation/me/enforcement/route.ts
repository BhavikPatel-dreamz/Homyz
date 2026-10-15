import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

// GET /api/v1/moderation/me/enforcement — retrieve the authenticated caller's enforcement status
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const status = await moderationService.getUserEnforcementStatus(actor.id);
  return ok(status);
});

