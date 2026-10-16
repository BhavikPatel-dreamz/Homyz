import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/moderation/cases/[id]/booking-impact — evaluate reservation/financial impact of enforcement
export const GET = apiHandler(async (req, context: RouteParams) => {
  await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_READ);
  const { id: caseId } = await context.params;
  const targetUserId = req.nextUrl.searchParams.get("userId") || undefined;

  const impact = await moderationService.getCaseBookingImpact(caseId, targetUserId);
  return ok(impact);
});

