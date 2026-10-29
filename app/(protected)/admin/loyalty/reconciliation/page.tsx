import { AdminLoyaltyReconciliationClient } from "@/components/admin/loyalty/admin-loyalty-reconciliation-client";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listStayEliteReconciliationRuns } from "@/services/stayelite-reconciliation.service";

export const metadata = { title: "StayElite Reconciliation | Homyz Admin" };
export default async function AdminLoyaltyReconciliationPage() {
  await requirePagePermission(PERMISSIONS.LOYALTY_RECONCILIATION_VIEW);
  return <AdminLoyaltyReconciliationClient initialRuns={await listStayEliteReconciliationRuns()} />;
}
