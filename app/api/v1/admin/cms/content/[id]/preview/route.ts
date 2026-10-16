import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { generatePreviewToken } from "@/lib/cms/preview-token";
import { cmsService } from "@/services/cms.service";

// POST /api/v1/admin/cms/content/[id]/preview — Generate scoped preview token
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_PREVIEW);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { versionId?: string };

  const content = await cmsService.getContentById(id);
  const targetVersionId = body?.versionId || content.draftVersionId || content.versions[0]?.id;

  if (!targetVersionId) {
    throw new Error("No version available to preview");
  }

  const token = await generatePreviewToken({
    contentId: id,
    versionId: targetVersionId,
    actorId: actor.id,
    type: content.type,
  });

  return ok({
    token,
    previewUrl: `/api/v1/admin/cms/preview/${token}`,
    expiresInSeconds: 3600,
  });
});

