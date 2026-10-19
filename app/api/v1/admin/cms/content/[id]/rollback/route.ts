import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";

// POST /api/v1/admin/cms/content/[id]/rollback — Non-destructive rollback to earlier version
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_ROLLBACK);
  const { id } = await params;
  const body = await req.json();

  if (!body.versionId) {
    throw new Error("Missing required field: versionId");
  }

  const rolledBack = await cmsService.rollbackToRevision(
    actor,
    id,
    body.versionId,
    body.publishImmediately ?? true
  );

  return ok(rolledBack);
});

