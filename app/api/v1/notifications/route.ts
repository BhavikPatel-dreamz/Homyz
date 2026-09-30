import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { notificationService } from "@/services/notification.service";
import { NotificationType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const searchParams = req.nextUrl.searchParams;

  const rawType = searchParams.get("type");
  const type =
    rawType && Object.values(NotificationType).includes(rawType as NotificationType)
      ? (rawType as NotificationType)
      : undefined;

  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
  const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

  const userId = actor.id;
  const result = await notificationService.listForUser(userId, {
    type,
    unreadOnly,
    skip,
    take,
  });

  const response = ok(result);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});

