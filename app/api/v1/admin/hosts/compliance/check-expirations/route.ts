import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostComplianceService } from "@/services/host-compliance.service";

export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_COMPLIANCE_MANAGE);

  const result = await hostComplianceService.checkDocumentExpirations(actor);
  return ok(result);
});
