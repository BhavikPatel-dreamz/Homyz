import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { paginated } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";

// GET /api/v1/admin/activity-logs — paginated audit logs
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.ACTIVITY_LOGS_VIEW);
  const sp = req.nextUrl.searchParams;
  const { page, limit } = parsePagination(sp);

  const action = sp.get("action") || undefined;
  const resourceType = sp.get("resourceType") || undefined;
  const status = (sp.get("status") as "SUCCESS" | "FAILURE") || undefined;
  const search = sp.get("search") || undefined;

  const result = await auditService.list({
    page,
    limit,
    action,
    resourceType,
    status,
    search,
  });

  return paginated(result.items, buildPagination(page, limit, result.pagination.total));
});
