import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostComplianceService } from "@/services/host-compliance.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_COMPLIANCE_SUSPEND);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  if (!body.reason || !body.reason.trim()) {
    throw AppError.badRequest("Reactivation reason is required");
  }

  const updated = await hostComplianceService.unsuspendHostForCompliance(
    actor,
    id,
    body.reason.trim()
  );

  return ok(updated);
});
