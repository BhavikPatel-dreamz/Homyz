import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

// POST /api/v1/admin/hosts/registration-requests/documents/[documentId]/request-resubmission
export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_REQUEST_RESUBMISSION);
  const { documentId } = await (ctx as any).params;
  const body = await req.json();

  const reason = body.reason;
  const instructions = body.instructions || "";

  const updated = await hostRegistrationService.requestDocumentResubmission(
    actor,
    documentId,
    reason,
    instructions
  );
  return ok(updated);
});
