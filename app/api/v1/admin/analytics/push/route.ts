import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { pushNotificationsService } from "@/services/admin-analytics/push-notifications.service";
import { AppError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [PERMISSIONS.ANALYTICS_VIEW]);

  const subscriptions = pushNotificationsService.getUserSubscriptions(actor.id);
  const telemetry = pushNotificationsService.getTelemetry();

  return ok({
    isSubscribed: subscriptions.length > 0,
    subscriptions,
    telemetry,
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [PERMISSIONS.ANALYTICS_VIEW]);

  const body = await req.json().catch(() => ({}));
  const { endpoint, keys, preferences, userAgent } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw AppError.badRequest("Invalid Web Push subscription payload: endpoint and keys are required.");
  }

  const sub = await pushNotificationsService.registerSubscription({
    userId: actor.id,
    endpoint,
    keys,
    preferences,
    userAgent,
  });

  return ok(sub);
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [PERMISSIONS.ANALYTICS_VIEW]);

  const body = await req.json().catch(() => ({}));
  const { endpoint } = body;

  if (!endpoint) {
    throw AppError.badRequest("Query or body parameter 'endpoint' is required.");
  }

  const removed = await pushNotificationsService.removeSubscription(actor.id, endpoint);
  return ok({ success: true, removed });
});

