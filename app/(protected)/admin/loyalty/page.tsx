import { AdminLoyaltyOverviewClient } from "@/components/admin/loyalty/admin-loyalty-overview-client";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAdminLoyaltyOverview } from "@/services/admin-loyalty-overview.service";
export const metadata = { title: "StayElite Operations | Homyz Admin" };
export default async function AdminLoyaltyPage() { await requirePagePermission(PERMISSIONS.LOYALTY_OVERVIEW_VIEW); return <AdminLoyaltyOverviewClient initialOverview={await getAdminLoyaltyOverview()} />; }
