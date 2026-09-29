import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const result = await messagingService.declineInquiry(actor, id, {
    reason: body.reason,
    messageText: body.messageText,
  });

  return ok(result);
});

