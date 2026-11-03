import { SupportAnalyticsDashboard } from "@/components/admin/support/support-analytics-dashboard";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportAnalyticsService, type SupportAnalyticsQuery } from "@/services/support-analytics.service";

export const dynamic = "force-dynamic";

export default async function SupportAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePagePermission(PERMISSIONS.DISPUTES_VIEW);
  const raw = await searchParams;
  const filters = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])) as SupportAnalyticsQuery;
  return <SupportAnalyticsDashboard initialAnalytics={await supportAnalyticsService.getSupportAnalytics(actor, filters)} initialFilters={filters} />;
}
