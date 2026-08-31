import { apiHandler } from "@/lib/api/handler";
import { paginated } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostComplianceService } from "@/services/host-compliance.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, [PERMISSIONS.HOST_COMPLIANCE_VIEW, PERMISSIONS.HOSTS_VIEW]);

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "10", 10);
  const search = url.searchParams.get("search") || undefined;
  const complianceStatus = url.searchParams.get("complianceStatus") || undefined;
  const documentStatus = url.searchParams.get("documentStatus") || undefined;
  const riskLevel = url.searchParams.get("riskLevel") || undefined;
  const issueStatus = url.searchParams.get("issueStatus") || undefined;
  const reviewerId = url.searchParams.get("reviewerId") || undefined;
  const hostStatus = url.searchParams.get("hostStatus") || undefined;

  const result = await hostComplianceService.listHostComplianceRecords({
    page,
    pageSize,
    search,
    complianceStatus,
    documentStatus,
    riskLevel,
    issueStatus,
    reviewerId,
    hostStatus,
  });

  return paginated(result.items, result.pagination);
});
