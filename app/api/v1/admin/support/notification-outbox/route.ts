import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { notificationOutboxService } from "@/services/notification-outbox.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.NOTIFICATIONS_VIEW);
  return ok(await notificationOutboxService.getNotificationOutboxSummary());
});
