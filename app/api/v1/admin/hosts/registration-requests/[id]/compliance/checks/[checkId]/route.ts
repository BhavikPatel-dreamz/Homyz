import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const PATCH = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_MANAGE_COMPLIANCE);
  const { checkId } = await (ctx as any).params;
  const body = await req.json();

  const { status, notes } = body;

  if (!status || !["PENDING", "PASSED", "FAILED"].includes(status)) {
    throw AppError.badRequest("Status must be PENDING, PASSED, or FAILED");
  }

  const updatedCheck = await hostRegistrationService.updateComplianceCheck(
    actor,
    checkId,
    status,
    notes
  );

  return ok(updatedCheck);
});
