import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { StayEliteReconciliationMode } from "@/generated/prisma/enums";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { executeStayEliteReconciliationRun } from "@/services/stayelite-reconciliation.service";

export const POST = apiHandler(async (req, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const run = await prisma.stayEliteReconciliationRun.findUnique({ where: { id }, select: { mode: true } });
  const actor = await requireApiPermission(req, run?.mode === StayEliteReconciliationMode.EVIDENCE_ONLY
    ? PERMISSIONS.LOYALTY_RECONCILIATION_EVIDENCE_BACKFILL
    : PERMISSIONS.LOYALTY_RECONCILIATION_RUN);
  return ok(await executeStayEliteReconciliationRun(id, actor));
});
