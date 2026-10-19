import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsMediaService } from "@/services/cms-media.service";

// GET /api/v1/admin/cms/media/[id] — Get media details & usage references
export const GET = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, PERMISSIONS.CMS_MEDIA_VIEW);
  const { id } = await params;

  const asset = await cmsMediaService.getMediaById(id);
  return ok(asset);
});

// PATCH /api/v1/admin/cms/media/[id] — Update media title and alt text
export const PATCH = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_MEDIA_UPLOAD);
  const { id } = await params;
  const body = await req.json();

  const updated = await cmsMediaService.updateMediaMetadata(actor, id, {
    title: body.title,
    altText: body.altText,
    altTexts: body.altTexts,
  });

  return ok(updated);
});

// DELETE /api/v1/admin/cms/media/[id] — Safe delete media (rejected if referenced)
export const DELETE = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_MEDIA_DELETE);
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const forceArchive = searchParams.get("forceArchive") === "true";

  const result = await cmsMediaService.deleteMedia(actor, id, { forceArchive });
  return ok(result);
});

