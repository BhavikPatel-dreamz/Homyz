import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getModerationAnalytics, AnalyticsPeriod } from "@/services/moderation-analytics.service";
import { AppError } from "@/lib/api/errors";
import { ModerationSetupPending } from "@/components/admin/moderation-setup-pending";
import { AdminModerationDashboardClient } from "./admin-moderation-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    startDate?: string;
    endDate?: string;
    targetType?: string;
    status?: string;
  }>;
}) {
  const actor = await requirePagePermission(PERMISSIONS.MODERATION_CASE_READ);
  const filters = await searchParams;

  let analytics = null;
  let unavailableMessage: string | null = null;

  const period = (filters.period || (filters.startDate || filters.endDate ? "custom" : "30d")) as AnalyticsPeriod;

  try {
    analytics = await getModerationAnalytics(actor, {
      period,
      startDate: filters.startDate,
      endDate: filters.endDate,
      targetType: filters.targetType,
      status: filters.status,
    });
  } catch (error) {
    if (error instanceof AppError && error.status === 503) {
      unavailableMessage = error.message;
    } else {
      throw error;
    }
  }

  if (unavailableMessage || !analytics) {
    return <ModerationSetupPending message={unavailableMessage || undefined} />;
  }

  return (
    <AdminModerationDashboardClient
      initialAnalytics={analytics}
      initialFilters={{
        period,
        startDate: filters.startDate,
        endDate: filters.endDate,
        targetType: filters.targetType,
        status: filters.status,
      }}
    />
  );
}
