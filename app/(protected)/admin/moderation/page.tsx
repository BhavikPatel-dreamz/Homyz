import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";
import { AppError } from "@/lib/api/errors";
import { ModerationSetupPending } from "@/components/admin/moderation-setup-pending";
import { AdminModerationDashboardClient } from "./admin-moderation-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const actor = await requirePagePermission(PERMISSIONS.MODERATION_CASE_READ);
  const filters = await searchParams;
  let summary = null;
  let unavailableMessage: string | null = null;
  try {
    summary = await moderationService.getModerationDashboardSummary(actor, filters);
  } catch (error) {
    if (error instanceof AppError && error.status === 503) unavailableMessage = error.message;
    else throw error;
  }
  if (unavailableMessage || !summary) return <ModerationSetupPending message={unavailableMessage || undefined} />;
  return <AdminModerationDashboardClient initialSummary={summary} initialFilters={filters} />;
}
