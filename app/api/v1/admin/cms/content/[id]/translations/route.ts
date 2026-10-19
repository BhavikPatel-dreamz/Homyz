import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";

// GET /api/v1/admin/cms/content/[id]/translations — Get translations group and completeness
export const GET = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, PERMISSIONS.CMS_VIEW);
  const { id } = await params;

  const result = await cmsService.getTranslations(id);
  return ok(result);
});

// POST /api/v1/admin/cms/content/[id]/translations — Create a translation in targetLocale
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_EDIT);
  const { id } = await params;
  const body = (await req.json()) as {
    targetLocale: string;
    title?: string;
    slug?: string;
    payload?: Record<string, unknown>;
  };

  const newTranslation = await cmsService.createTranslation(actor, {
    sourceContentId: id,
    targetLocale: body.targetLocale,
    title: body.title,
    slug: body.slug,
    payload: body.payload,
  });

  return ok(newTranslation, 201);
});

