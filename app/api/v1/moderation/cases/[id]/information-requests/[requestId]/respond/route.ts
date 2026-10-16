import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string; requestId: string }>;
}

const respondRfiSchema = z.object({
  responseText: z.string().trim().max(5000).optional(),
  evidenceIds: z.array(z.string().trim()).optional(),
});

// POST /api/v1/moderation/cases/[id]/information-requests/[requestId]/respond — submit response to an RFI
export const POST = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId, requestId } = await context.params;

  const body = await req.json();
  const input = respondRfiSchema.parse(body);

  const result = await moderationService.respondToInformationRequest(actor, caseId, requestId, {
    responseText: input.responseText,
    evidenceIds: input.evidenceIds,
  });

  return ok(result);
});

