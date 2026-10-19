import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";

// POST /api/v1/admin/cms/content/[id]/publish — Publish active revision or specified version
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_PUBLISH);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { versionId?: string };

  const published = await cmsService.publishRevision(actor, id, body?.versionId);
  return ok(published);
});

