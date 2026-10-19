import { apiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsMediaService } from "@/services/cms-media.service";
import { AppError } from "@/lib/api/errors";

// GET /api/v1/admin/cms/media — List media library assets
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_MEDIA_VIEW);

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "24", 10);
  const search = searchParams.get("search") || undefined;
  const mimeType = searchParams.get("mimeType") || undefined;

  const result = await cmsMediaService.listMedia({
    page,
    limit,
    search,
    mimeType,
  });

  return ok(result);
});

// POST /api/v1/admin/cms/media — Upload image to media library
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_MEDIA_UPLOAD);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null) || undefined;
  const altText = (formData.get("altText") as string | null) || undefined;

  if (!file || typeof file === "string") {
    throw AppError.badRequest("No image file provided in form data");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const mediaAsset = await cmsMediaService.uploadMedia(actor, {
    buffer,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    title,
    altText,
  });

  console.log("[CMS MEDIA] Uploaded media asset:", mediaAsset);
  return created(mediaAsset);
});

