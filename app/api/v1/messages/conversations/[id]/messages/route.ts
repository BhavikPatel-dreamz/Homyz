import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";
import { MessageType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  const searchParams = req.nextUrl.searchParams;
  const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
  const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

  const result = await messagingService.getConversationMessages(actor, id, { skip, take });

  const response = ok(result);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  const body = await req.json();
  const content = body.content || "";
  const type = (body.type as MessageType) || MessageType.TEXT;
  const metadata = body.metadata;
  const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds : undefined;

  const message = await messagingService.sendMessage(actor, id, {
    content,
    type,
    metadata,
    attachmentIds,
  });

  return created(message);
});

