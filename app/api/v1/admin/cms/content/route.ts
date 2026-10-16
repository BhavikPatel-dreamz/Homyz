import { apiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsService } from "@/services/cms.service";
import { CmsContentTypeEnum, CmsContentStatus } from "@/generated/prisma/enums";

// GET /api/v1/admin/cms/content — List CMS content records
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_VIEW);

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const type = searchParams.get("type") as CmsContentTypeEnum | null;
  const status = searchParams.get("status") as CmsContentStatus | null;
  const search = searchParams.get("search") || undefined;
  const sortBy = (searchParams.get("sortBy") as any) || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") as any) || "desc";

  const result = await cmsService.listContent({
    page,
    limit,
    type: type || undefined,
    status: status || undefined,
    search,
    sortBy,
    sortOrder,
  });

  return ok(result);
});

// POST /api/v1/admin/cms/content — Create new CMS content record
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.CMS_CREATE);
  const body = await req.json();

  const content = await cmsService.createContent(actor, {
    type: body.type,
    title: body.title,
    slug: body.slug,
    locale: body.locale,
    payload: body.payload || {},
    metadata: body.metadata,
    changeSummary: body.changeSummary,
  });

  return created(content);
});

