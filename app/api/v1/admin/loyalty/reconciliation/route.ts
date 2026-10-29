import { StayEliteReconciliationMode } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createStayEliteReconciliationRun, listStayEliteReconciliationRuns, type ReconciliationInput } from "@/services/stayelite-reconciliation.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_RECONCILIATION_VIEW);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  return ok(await listStayEliteReconciliationRuns(limit));
});

// Creating a run is intentionally separate from executing it. A browser visit
// or a malformed request can therefore never start a historical scan.
export const POST = apiHandler(async (req) => {
  const body = await req.json() as ReconciliationInput;
  const permission = body.mode === StayEliteReconciliationMode.EVIDENCE_ONLY
    ? PERMISSIONS.LOYALTY_RECONCILIATION_EVIDENCE_BACKFILL
    : PERMISSIONS.LOYALTY_RECONCILIATION_RUN;
  const actor = await requireApiPermission(req, permission);
  return created(await createStayEliteReconciliationRun(actor, body));
});
