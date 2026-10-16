import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { jobQueueService } from "@/services/job-queue.service";
import { AdminJobsClient } from "./admin-jobs-client";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>;
}) {
  const actor = await requirePagePermission(PERMISSIONS.BACKGROUND_JOBS_VIEW);
  const params = await searchParams;

  const page = parseInt(params.page || "1", 10);
  const status = (params.status || "ALL") as any;
  const type = (params.type || "ALL") as any;

  const [initialData, initialStats] = await Promise.all([
    jobQueueService.listJobs({ status, type, page, limit: 20 }),
    jobQueueService.getQueueStats(),
  ]);

  return (
    <AdminJobsClient
      initialJobs={initialData.jobs}
      initialTotal={initialData.total}
      initialPage={initialData.page}
      initialLimit={initialData.limit}
      initialTotalPages={initialData.totalPages}
      initialStats={initialStats}
      initialFilters={{ status, type }}
      canManage={actor.role === "ADMIN"}
    />
  );
}

