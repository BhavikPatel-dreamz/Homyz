import { AdminLoyaltyAnalyticsClient } from "@/components/admin/loyalty/admin-loyalty-analytics-client";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAdminLoyaltyAnalytics } from "@/services/admin-loyalty-analytics.service";
export const metadata = { title: "StayElite Analytics | Homyz Admin" };
export default async function AdminLoyaltyAnalyticsPage() { await requirePagePermission(PERMISSIONS.LOYALTY_ANALYTICS_VIEW); return <AdminLoyaltyAnalyticsClient analytics={await getAdminLoyaltyAnalytics()} />; }
