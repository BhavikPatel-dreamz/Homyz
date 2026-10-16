import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { jobQueueService, BackgroundJobType, BackgroundJobStatus } from "@/services/job-queue.service";

const enqueueJobSchema = z.object({
  type: z.enum([
    "REVIEW_EXPIRY_PUBLISH",
    "ACCOUNT_RESTRICTION_EXPIRY",
    "MODERATION_NOTIFICATION_DELIVERY",
    "AUDIT_LOG_ARCHIVE",
    "SYSTEM_MAINTENANCE",
  ]),
  payload: z.record(z.string(), z.any()).optional(),
  priority: z.number().int().min(0).max(10).optional(),
});

// GET /api/v1/admin/jobs — list background jobs and queue stats
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BACKGROUND_JOBS_VIEW);
  const url = new URL(req.url);

  const status = (url.searchParams.get("status") || "ALL") as BackgroundJobStatus | "ALL";
  const type = (url.searchParams.get("type") || "ALL") as BackgroundJobType | "ALL";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const [listResult, stats] = await Promise.all([
    jobQueueService.listJobs({ status, type, page, limit }),
    jobQueueService.getQueueStats(),
  ]);

  return ok({
    ...listResult,
    stats,
  });
});

// POST /api/v1/admin/jobs — manually enqueue a background job
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BACKGROUND_JOBS_MANAGE);
  const body = enqueueJobSchema.parse(await req.json());

  const job = await jobQueueService.enqueueJob({
    type: body.type as BackgroundJobType,
    payload: body.payload,
    priority: body.priority ?? 5,
  });

  return ok({ job });
});

