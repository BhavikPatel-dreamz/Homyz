import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

// GET /api/v1/admin/hosts/registration-requests/documents/[documentId]/preview
export const GET = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS);
  const { documentId } = await (ctx as any).params;

  const result = await hostRegistrationService.getSecureDocumentUrl(actor, documentId);
  return ok(result);
});
