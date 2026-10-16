import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsMediaService } from "@/services/cms-media.service";
import { AppError } from "@/lib/api/errors";

// POST /api/v1/admin/cms/media/bulk-delete — Bulk delete or archive media assets
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_MEDIA_DELETE);

  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    forceArchive?: boolean;
  };

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    throw AppError.badRequest("Please provide an array of asset IDs to delete");
  }

  const result = await cmsMediaService.bulkDeleteMedia(actor, body.ids, {
    forceArchive: body.forceArchive,
  });

  return ok(result);
});

