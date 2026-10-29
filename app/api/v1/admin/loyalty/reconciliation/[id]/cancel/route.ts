import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cancelStayEliteReconciliationRun } from "@/services/stayelite-reconciliation.service";

export const POST = apiHandler(async (req, context: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_RECONCILIATION_RUN);
  const { id } = await context.params;
  return ok(await cancelStayEliteReconciliationRun(id, actor));
});
