import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CONTENT_TYPE_REGISTRY } from "@/lib/cms/content-types";

// GET /api/v1/admin/cms/types — List supported CMS content types and schemas
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_VIEW);

  const types = Object.values(CONTENT_TYPE_REGISTRY).map((def) => ({
    type: def.type,
    displayName: def.displayName,
    description: def.description,
    supportsSlug: def.supportsSlug,
    supportsScheduling: def.supportsScheduling,
    supportsPreview: def.supportsPreview,
    allowedPlacements: def.allowedPlacements,
    defaultPayload: def.defaultPayload,
  }));

  return ok(types);
});

