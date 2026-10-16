import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const submitAppealSchema = z.object({
  reason: z.string().trim().min(1, "Appeal reason is required"),
  explanation: z.string().trim().min(10, "Explanation must be at least 10 characters").max(2500, "Explanation cannot exceed 2500 characters"),
  evidenceIds: z.array(z.string().trim()).optional().default([]),
});

// GET /api/v1/moderation/cases/[id]/appeals — list appeals for case
export const GET = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId } = await context.params;
  const appeals = await moderationService.listCaseAppeals(actor, caseId);
  return ok(appeals);
});

// POST /api/v1/moderation/cases/[id]/appeals — submit moderation appeal
export const POST = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId } = await context.params;

  const body = await req.json();
  const input = submitAppealSchema.parse(body);

  const appeal = await moderationService.submitModerationAppeal(actor, caseId, {
    reason: input.reason,
    explanation: input.explanation,
    evidenceIds: input.evidenceIds,
  });

  return created(appeal);
});

