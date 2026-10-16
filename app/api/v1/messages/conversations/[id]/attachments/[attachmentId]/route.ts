import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";

export const DELETE = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const { id: conversationId, attachmentId } = resolvedParams;

  const result = await messagingService.removeStagedAttachment(
    actor,
    conversationId,
    attachmentId
  );

  return ok(result);
});

