import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { z } from "zod";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { notificationOutboxService } from "@/services/notification-outbox.service";
import { NotificationDeliveryStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
const querySchema = z.object({
  status: z.nativeEnum(NotificationDeliveryStatus).optional(),
  page: z.coerce.number().int().positive().optional(),
});

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.NOTIFICATIONS_VIEW);
  return ok(await notificationOutboxService.getNotificationOutboxSummary(querySchema.parse(Object.fromEntries(req.nextUrl.searchParams))));
});
