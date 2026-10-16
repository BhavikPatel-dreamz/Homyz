import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createRfiSchema = z.object({
  recipientId: z.string().trim().min(1),
  requestText: z.string().trim().min(1).max(5000),
  deadline: z.string().datetime().optional().nullable(),
});

// GET /api/v1/moderation/cases/[id]/information-requests — list RFIs for case
export const GET = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId } = await context.params;
  const rfis = await moderationService.listInformationRequests(actor, caseId);
  return ok(rfis);
});

// POST /api/v1/moderation/cases/[id]/information-requests — create new RFI (Admin only)
export const POST = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId } = await context.params;

  const body = await req.json();
  const input = createRfiSchema.parse(body);

  const rfi = await moderationService.createInformationRequest(actor, caseId, {
    recipientId: input.recipientId,
    requestText: input.requestText,
    deadline: input.deadline || undefined,
  });

  return created(rfi);
});

