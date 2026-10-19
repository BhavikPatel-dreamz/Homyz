import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";

// POST /api/v1/admin/cms/content/[id]/unpublish — Unpublish content
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_UNPUBLISH);
  const { id } = await params;

  const unpublished = await cmsService.unpublishContent(actor, id);
  return ok(unpublished);
});

