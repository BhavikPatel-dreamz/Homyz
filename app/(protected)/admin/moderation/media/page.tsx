import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";
import { AppError } from "@/lib/api/errors";
import { ModerationSetupPending } from "@/components/admin/moderation-setup-pending";
import { AdminModerationCasesClient } from "../admin-moderation-cases-client";

export const dynamic = "force-dynamic";

export default async function AdminModerationMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePagePermission(PERMISSIONS.MODERATION_CASE_READ);
  const sp = await searchParams;
  let result;
  let moderators;
  let unavailableMessage: string | null = null;
  try {
    [result, moderators] = await Promise.all([
      moderationService.listModerationCases(actor, {
        page: Number(sp.page) || 1,
        limit: Number(sp.limit) || 20,
        status: (sp.status as never) || undefined,
        targetType: "LISTING_PHOTO",
        severity: (sp.severity as never) || undefined,
        category: sp.category,
        assigned: sp.assigned as "assigned" | "unassigned" | undefined,
        attention: sp.attention === "1",
        assignedModeratorId: sp.assignedModeratorId,
        search: sp.search,
        startDate: sp.startDate,
        endDate: sp.endDate,
        updatedStartDate: sp.updatedStartDate,
        updatedEndDate: sp.updatedEndDate,
        sort: (sp.sort as never) || undefined,
      }),
      moderationService.listModerationAssigneeFilters(actor),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.status === 503) unavailableMessage = error.message;
    else throw error;
  }
  if (unavailableMessage || !result || !moderators) return <ModerationSetupPending message={unavailableMessage || undefined} />;
  return (
    <AdminModerationCasesClient
      initialCases={result.cases}
      initialPagination={result.pagination}
      initialFilters={{ ...sp, targetType: "LISTING_PHOTO" }}
      initialModerators={moderators}
    />
  );
}

