import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const PATCH = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_MANAGE_COMPLIANCE);
  const { issueId } = await (ctx as any).params;
  const body = await req.json();

  const { status, resolutionNotes } = body;

  if (!status || !["RESOLVED", "REJECTED"].includes(status)) {
    throw AppError.badRequest("Status must be RESOLVED or REJECTED");
  }

  const updatedIssue = await hostRegistrationService.resolveComplianceIssue(
    actor,
    issueId,
    status,
    resolutionNotes
  );

  return ok(updatedIssue);
});
