import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";
import { AppError } from "@/lib/api/errors";
import { ModerationSetupPending } from "@/components/admin/moderation-setup-pending";
import { AdminAppealsClient } from "./admin-appeals-client";

export const dynamic = "force-dynamic";

export default async function AdminModerationAppealsPage({
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
      moderationService.listModerationAppeals(actor, {
        page: Number(sp.page) || 1,
        limit: Number(sp.limit) || 20,
        status: (sp.status as any) || undefined,
        decision: (sp.decision as any) || undefined,
        assignedReviewerId: sp.assignedReviewerId || undefined,
        search: sp.search || undefined,
        sort: (sp.sort as any) || undefined,
      }),
      moderationService.listEligibleModerators(actor),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.status === 503) unavailableMessage = error.message;
    else throw error;
  }

  if (unavailableMessage || !result) {
    return <ModerationSetupPending message={unavailableMessage || undefined} />;
  }

  return (
    <AdminAppealsClient
      initialAppeals={result.items}
      initialPagination={{
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }}
      initialSummary={result.summary}
      initialFilters={sp}
      moderators={moderators || []}
    />
  );
}

