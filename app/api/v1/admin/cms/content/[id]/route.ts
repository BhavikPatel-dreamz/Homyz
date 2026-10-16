import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";

// GET /api/v1/admin/cms/content/[id] — Get single content details
export const GET = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, PERMISSIONS.CMS_VIEW);
  const { id } = await params;

  const content = await cmsService.getContentById(id);
  return ok(content);
});

// PUT /api/v1/admin/cms/content/[id] — Update draft content
export const PUT = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_EDIT);
  const { id } = await params;
  const body = await req.json();

  const updated = await cmsService.updateDraft(actor, id, {
    title: body.title,
    slug: body.slug,
    locale: body.locale,
    payload: body.payload,
    changeSummary: body.changeSummary,
    expectedVersionNumber: body.expectedVersionNumber,
  });

  return ok(updated);
});

// DELETE /api/v1/admin/cms/content/[id] — Archive content
export const DELETE = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_EDIT);
  const { id } = await params;

  const archived = await cmsService.archiveContent(actor, id);
  return ok(archived);
});

