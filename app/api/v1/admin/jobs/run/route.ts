import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { jobQueueService } from "@/services/job-queue.service";

// POST /api/v1/admin/jobs/run — trigger immediate execution of due background jobs
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BACKGROUND_JOBS_MANAGE);
  const result = await jobQueueService.runBatch({ batchSize: 20 });
  const stats = await jobQueueService.getQueueStats();
  return ok({
    ...result,
    stats,
  });
});

