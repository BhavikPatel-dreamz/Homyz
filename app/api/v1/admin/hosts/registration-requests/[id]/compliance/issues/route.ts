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

  const { issueType, description, severity } = body;

  if (!issueType || !description) {
    throw AppError.badRequest("Issue type and description are required");
  }

  const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const issueSeverity = validSeverities.includes(severity) ? severity : "MEDIUM";

  const issue = await hostRegistrationService.createComplianceIssue(
    actor,
    id,
    issueType.trim(),
    description.trim(),
    issueSeverity
  );

  return ok(issue);
});
