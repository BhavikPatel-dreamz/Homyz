import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";
import { CmsScheduledStatus } from "@/generated/prisma/enums";

// GET /api/v1/admin/cms/schedule — List upcoming / all scheduled actions
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_SCHEDULE);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as CmsScheduledStatus | null;

  const actions = await cmsService.listScheduledActions(status || undefined);
  return ok(actions);
});

