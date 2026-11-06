import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reportSchedulerService } from "@/services/admin-analytics/report-scheduler.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const includeHistory = searchParams.get("history") === "true";

  const [schedules, executions] = await Promise.all([
    reportSchedulerService.listSchedules(actor),
    includeHistory ? reportSchedulerService.listExecutions(actor) : Promise.resolve([]),
  ]);

  return ok({ schedules, executions });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const action = body.action || "create";

  if (action === "run_now") {
    const execution = await reportSchedulerService.executeSchedule(body.scheduleId, actor);
    return ok(execution);
  }

  const created = await reportSchedulerService.createSchedule(actor, {
    name: body.name,
    reportType: body.reportType,
    filters: body.filters,
    outputFormat: body.outputFormat,
    frequency: body.frequency,
    deliveryTimeUtc: body.deliveryTimeUtc,
    deliveryDayOfWeek: body.deliveryDayOfWeek,
    deliveryDayOfMonth: body.deliveryDayOfMonth,
    deliveryTimezone: body.deliveryTimezone,
    recipientEmails: body.recipientEmails,
  });

  return ok(created);
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const updated = await reportSchedulerService.updateScheduleStatus(
    actor,
    body.scheduleId,
    body.status
  );

  return ok(updated);
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("id");
  if (!scheduleId) {
    return NextResponse.json({ success: false, error: "Schedule ID required" }, { status: 400 });
  }

  await reportSchedulerService.deleteSchedule(actor, scheduleId);
  return ok({ deleted: true });
});

