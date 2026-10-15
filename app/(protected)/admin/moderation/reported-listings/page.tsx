import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";
import { AppError } from "@/lib/api/errors";
import { ModerationSetupPending } from "@/components/admin/moderation-setup-pending";
import { AdminModerationCasesClient } from "../admin-moderation-cases-client";

export const dynamic = "force-dynamic";

export default async function AdminReportedListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePagePermission(PERMISSIONS.MODERATION_CASE_READ);
  const sp = await searchParams;
  const filters: Record<string, string | undefined> = {
    ...sp,
    targetType: "LISTING",
  };

  let result;
  let moderators;
  let unavailableMessage: string | null = null;

  try {
    [result, moderators] = await Promise.all([
      moderationService.listModerationCases(actor, {
        page: Number(filters.page) || 1,
        limit: Number(filters.limit) || 20,
        status: (filters.status as never) || undefined,
        targetType: "LISTING",
        severity: (filters.severity as never) || undefined,
        category: filters.category,
        assigned: filters.assigned as "assigned" | "unassigned" | undefined,
        attention: filters.attention === "1",
        assignedModeratorId: filters.assignedModeratorId,
        search: filters.search,
        startDate: filters.startDate,
        endDate: filters.endDate,
        updatedStartDate: filters.updatedStartDate,
        updatedEndDate: filters.updatedEndDate,
        sort: (filters.sort as never) || undefined,
      }),
      moderationService.listModerationAssigneeFilters(actor),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.status === 503) unavailableMessage = error.message;
    else throw error;
  }

  if (unavailableMessage || !result || !moderators) {
    return <ModerationSetupPending message={unavailableMessage || undefined} />;
  }

  return (
    <AdminModerationCasesClient
      initialCases={result.cases}
      initialPagination={result.pagination}
      initialFilters={filters}
      initialModerators={moderators}
    />
  );
}

