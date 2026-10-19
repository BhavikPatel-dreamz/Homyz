import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cmsFooterService } from "@/services/cms-footer.service";
import { AppError } from "@/lib/api/errors";

// GET /api/v1/admin/cms/footer?locale=en — Fetch draft and version history for footer editor
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_VIEW);

  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") || "en";

  const data = await cmsFooterService.getDraftFooter(locale);
  return ok(data);
});

// POST /api/v1/admin/cms/footer — Save draft, publish, or rollback footer configuration
export const POST = apiHandler(async (req) => {
  const body = await req.json();
  const action = body.action || "draft";
  const locale = body.locale || "en";

  if (action === "draft") {
    const actor = await requireApiPermission(req, PERMISSIONS.CMS_EDIT);
    const result = await cmsFooterService.saveDraft(
      actor,
      body.payload,
      body.changeSummary || "Updated footer configuration draft",
      locale
    );
    return ok(result);
  }

  if (action === "publish") {
    const actor = await requireApiPermission(req, PERMISSIONS.CMS_PUBLISH);
    const result = await cmsFooterService.publishFooter(
      actor,
      body.versionId,
      locale
    );
    return ok(result);
  }

  if (action === "rollback") {
    const actor = await requireApiPermission(req, PERMISSIONS.CMS_ROLLBACK);
    if (!body.versionId) {
      throw AppError.badRequest("versionId is required for rollback");
    }
    const result = await cmsFooterService.rollbackFooter(
      actor,
      body.versionId,
      locale
    );
    return ok(result);
  }

  throw AppError.badRequest(`Unsupported action: ${action}`);
});

