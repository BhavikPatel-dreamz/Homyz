import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listSectionTemplates } from "@/lib/cms/section-registry";

// GET /api/v1/admin/cms/sections — List supported homepage section templates
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_VIEW);
  const templates = listSectionTemplates();
  return ok(templates);
});

