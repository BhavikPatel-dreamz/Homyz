import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { notificationService } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const result = await notificationService.markAllAsRead(actor.id);
  return ok(result);
});

