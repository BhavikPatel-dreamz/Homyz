import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsSettingsService } from "@/services/cms-settings.service";

// GET /api/v1/admin/cms/settings — Fetch global website settings
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_VIEW);
  const settings = await cmsSettingsService.getGlobalSettings();
  return ok(settings);
});

// POST /api/v1/admin/cms/settings — Update global website settings
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_EDIT);
  const body = await req.json();
  const updated = await cmsSettingsService.updateGlobalSettings(actor, body);
  return ok(updated);
});

// PUT /api/v1/admin/cms/settings — Update global website settings (alias)
export const PUT = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_EDIT);
  const body = await req.json();
  const updated = await cmsSettingsService.updateGlobalSettings(actor, body);
  return ok(updated);
});

