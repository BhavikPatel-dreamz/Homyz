import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";

// GET /api/v1/admin/cms/content/[id]/versions — List all versions of a content item
export const GET = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, PERMISSIONS.CMS_HISTORY);
  const { id } = await params;

  const revisions = await cmsService.listRevisions(id);
  return ok(revisions);
});

