import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  const conversation = await messagingService.getConversationById(actor, id);

  const response = ok(conversation);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});

