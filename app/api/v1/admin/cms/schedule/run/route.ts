import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsSchedulerService } from "@/services/cms-scheduler.service";

// POST /api/v1/admin/cms/schedule/run — Trigger immediate processing of due scheduled actions
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_SCHEDULE);

  const result = await cmsSchedulerService.executeDueScheduledActions(`admin_${actor.id}`);
  return ok(result);
});

