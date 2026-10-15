import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string; requestId: string }>;
}

const updateRfiSchema = z.object({
  status: z.enum(["REVIEWED", "CLOSED"]),
});

// PATCH /api/v1/moderation/cases/[id]/information-requests/[requestId] — update RFI status (Admin only)
export const PATCH = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId, requestId } = await context.params;

  const body = await req.json();
  const input = updateRfiSchema.parse(body);

  const result = await moderationService.updateInformationRequestStatus(actor, caseId, requestId, input.status);
  return ok(result);
});

