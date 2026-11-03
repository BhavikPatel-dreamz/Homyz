import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { notificationOutboxService } from "@/services/notification-outbox.service";

export const dynamic = "force-dynamic";
const schema = z.object({ limit: z.number().int().min(1).max(50).optional() });

// Deliberately bounded; deployment invokes this route from a controlled scheduler
// or an authorized operational console, never from a self-running request loop.
export const POST = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.NOTIFICATIONS_MANAGE);
  const input = schema.parse(await req.json());
  return ok(await notificationOutboxService.processNotificationOutboxBatch(input));
});
