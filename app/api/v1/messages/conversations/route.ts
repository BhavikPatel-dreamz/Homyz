import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const searchParams = req.nextUrl.searchParams;

  const role = searchParams.get("role") as "guest" | "host" | "all" | null;
  const filter = searchParams.get("filter") as "all" | "unread" | null;
  const search = searchParams.get("search") || undefined;
  const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
  const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

  const result = await messagingService.listConversationsForUser(actor, {
    role: role || undefined,
    filter: filter || undefined,
    search,
    skip,
    take,
  });

  const response = ok(result);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});

