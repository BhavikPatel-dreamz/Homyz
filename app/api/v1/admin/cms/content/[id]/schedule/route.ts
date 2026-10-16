import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";

// POST /api/v1/admin/cms/content/[id]/schedule — Schedule publish/unpublish action
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_SCHEDULE);
  const { id } = await params;
  const body = await req.json();

  const action = await cmsService.scheduleAction(actor, {
    contentId: id,
    versionId: body.versionId,
    actionType: body.actionType,
    scheduledFor: body.scheduledFor,
  });

  return created(action);
});

