import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { notificationOutboxService } from "@/services/notification-outbox.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler(async (req, context: Context) => {
  const actor = await requireApiPermission(req, PERMISSIONS.NOTIFICATIONS_RETRY);
  const { id } = await context.params;
  return ok(await notificationOutboxService.retryNotificationOutboxEvent(actor, id));
});
