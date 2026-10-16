import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/moderation/users/[id]/violation-history — user repeat-violation history
export const GET = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_READ);
  const { id: userId } = await context.params;

  const history = await moderationService.getUserViolationHistory(actor, userId);
  return ok(history);
});

