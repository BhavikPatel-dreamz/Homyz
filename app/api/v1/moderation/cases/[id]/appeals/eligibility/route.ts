import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/moderation/cases/[id]/appeals/eligibility — check appeal eligibility
export const GET = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId } = await context.params;
  const eligibility = await moderationService.checkAppealEligibility(actor, caseId);
  return ok(eligibility);
});

