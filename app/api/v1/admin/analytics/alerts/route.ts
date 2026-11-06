import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { analyticsAlertsService } from "@/services/admin-analytics/alerts.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const [rules, alerts] = await Promise.all([
    analyticsAlertsService.listRules(actor),
    analyticsAlertsService.listAlertInstances(actor),
  ]);

  return ok({ rules, alerts });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.SYSTEM_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const action = body.action || "create";

  if (action === "evaluate") {
    const result = await analyticsAlertsService.evaluateAllRules(actor);
    return ok(result);
  }

  const newRule = await analyticsAlertsService.createRule(actor, {
    name: body.name,
    metric: body.metric,
    evaluationWindow: body.evaluationWindow,
    thresholdValue: Number(body.thresholdValue),
    comparisonBasis: body.comparisonBasis,
    severity: body.severity,
    notificationChannels: body.notificationChannels,
    cooldownHours: Number(body.cooldownHours || 24),
    isEnabled: Boolean(body.isEnabled ?? true),
  });

  return ok(newRule);
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const updated = await analyticsAlertsService.updateAlertStatus(
    actor,
    body.alertId,
    body.status
  );

  return ok(updated);
});

