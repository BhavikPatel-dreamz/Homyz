import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string; appealId: string }>;
}

// POST /api/v1/moderation/cases/[id]/appeals/[appealId]/withdraw — withdraw appeal
export const POST = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { appealId } = await context.params;

  const result = await moderationService.withdrawModerationAppeal(actor, appealId);
  return ok(result);
});

