import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string; appealId: string }>;
}

const assignReviewerSchema = z.object({
  reviewerId: z.string().trim().nullable(),
});

// GET /api/v1/moderation/cases/[id]/appeals/[appealId] — get appeal details
export const GET = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { appealId } = await context.params;
  const result = await moderationService.getModerationAppeal(actor, appealId);
  return ok(result);
});

// PATCH /api/v1/moderation/cases/[id]/appeals/[appealId] — assign reviewer
export const PATCH = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { appealId } = await context.params;

  const body = await req.json();
  const input = assignReviewerSchema.parse(body);

  const result = await moderationService.assignAppealReviewer(
    actor,
    appealId,
    input.reviewerId,
  );

  return ok(result);
});

