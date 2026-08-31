import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOperationsService } from "@/services/host-operations.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOST_OPERATIONS_VIEW);

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const priority = url.searchParams.get("priority") || undefined;
  const type = url.searchParams.get("type") || undefined;

  const queue = await hostOperationsService.getActionRequiredQueue({ search, priority, type });
  return ok(queue);
});
