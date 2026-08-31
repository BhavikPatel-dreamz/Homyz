import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostComplianceService } from "@/services/host-compliance.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_COMPLIANCE_RESOLVE_ISSUE);
  const { issueId } = await (ctx as any).params;
  const body = await req.json();

  if (!body.resolutionNotes || !body.resolutionNotes.trim()) {
    throw AppError.badRequest("Resolution notes are required");
  }

  const updated = await hostComplianceService.resolveComplianceIssue(
    actor,
    issueId,
    body.resolutionNotes.trim()
  );

  return ok(updated);
});
