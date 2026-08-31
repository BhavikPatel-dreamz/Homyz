import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_MANAGE_COMPLIANCE);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  const { complianceStatus, notes } = body;

  if (!complianceStatus || !["COMPLIANT", "NON_COMPLIANT", "ACTION_REQUIRED"].includes(complianceStatus)) {
    throw AppError.badRequest("Compliance status must be COMPLIANT, NON_COMPLIANT, or ACTION_REQUIRED");
  }

  const updated = await hostRegistrationService.updateComplianceDecision(
    actor,
    id,
    complianceStatus,
    notes
  );

  return ok(updated);
});
