import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostComplianceService } from "@/services/host-compliance.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, [PERMISSIONS.HOST_COMPLIANCE_VIEW, PERMISSIONS.HOSTS_VIEW]);

  const metrics = await hostComplianceService.getComplianceDashboardMetrics();
  return ok(metrics);
});
