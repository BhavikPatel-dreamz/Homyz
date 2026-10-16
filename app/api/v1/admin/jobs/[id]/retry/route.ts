import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { jobQueueService } from "@/services/job-queue.service";

// POST /api/v1/admin/jobs/:id/retry — authorized manual retry of a background job
export const POST = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.BACKGROUND_JOBS_MANAGE);
    const { id } = await ctx.params;

    const job = await jobQueueService.retryJob(id, actor);
    return ok({ job });
  }
);

