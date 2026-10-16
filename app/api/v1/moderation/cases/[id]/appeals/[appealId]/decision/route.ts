import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string; appealId: string }>;
}

const appealDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "PARTIALLY_APPROVED"]),
  decisionReason: z.string().trim().min(5, "Decision reason must be at least 5 characters").max(3000),
  reviewNotes: z.string().trim().max(3000).optional(),
  reinstateContent: z.boolean().optional().default(true),
  reopenCase: z.boolean().optional().default(true),
});

// POST /api/v1/moderation/cases/[id]/appeals/[appealId]/decision — record appeal decision
export const POST = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { appealId } = await context.params;

  const body = await req.json();
  const input = appealDecisionSchema.parse(body);

  const result = await moderationService.recordAppealDecision(actor, appealId, {
    decision: input.decision,
    decisionReason: input.decisionReason,
    reviewNotes: input.reviewNotes,
    reinstateContent: input.reinstateContent,
    reopenCase: input.reopenCase,
  });

  return ok(result);
});

