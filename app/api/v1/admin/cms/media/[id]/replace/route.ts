import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsMediaService } from "@/services/cms-media.service";
import { AppError } from "@/lib/api/errors";

// POST /api/v1/admin/cms/media/[id]/replace — Replace underlying image for existing asset
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_MEDIA_UPLOAD);
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || typeof file === "string") {
    throw AppError.badRequest("No image file provided for replacement");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const updated = await cmsMediaService.replaceMedia(actor, id, {
    buffer,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  });

  return ok(updated);
});

