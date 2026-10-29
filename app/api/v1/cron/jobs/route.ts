import { NextResponse } from "next/server";
import { jobQueueService } from "@/services/job-queue.service";
import { saudiLicenseService } from "@/services/saudi-license.service";

function validateCronSecret(req: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  // Scheduled work must be disabled rather than protected by a public,
  // guessable fallback when the deployment secret has not been configured.
  if (!configuredSecret) return false;
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const customHeader = req.headers.get("x-cron-key")?.trim() || "";

  if (!bearerToken && !customHeader) return false;
  return bearerToken === configuredSecret || customHeader === configuredSecret;
}

/**
 * GET /api/v1/cron/jobs
 * Health check & queue ping for monitoring services
 */
export async function GET(req: Request) {
  if (!validateCronSecret(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing cron secret." },
      { status: 401 }
    );
  }

  const stats = await jobQueueService.getQueueStats();
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    stats,
  });
}

/**
 * POST /api/v1/cron/jobs
 * AWS EventBridge Scheduler / Cron trigger:
 * 1. Automatically enqueues hourly scheduled tasks if due:
 *    - REVIEW_EXPIRY_PUBLISH
 *    - ACCOUNT_RESTRICTION_EXPIRY
 * 2. Processes a batch of due background jobs with worker locks
 */
export async function POST(req: Request) {
  if (!validateCronSecret(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing cron secret." },
      { status: 401 }
    );
  }

  const now = new Date();
  const currentHourKey = now.toISOString().slice(0, 13); // e.g. "2026-10-15T12"

  // 1. Ensure scheduled periodic tasks are enqueued for current hour window
  await Promise.allSettled([
    jobQueueService.enqueueJob({
      type: "REVIEW_EXPIRY_PUBLISH",
      idempotencyKey: `cron_review_publish_${currentHourKey}`,
      priority: 5,
      maxAttempts: 3,
      backoffSeconds: 60,
    }),
    jobQueueService.enqueueJob({
      type: "ACCOUNT_RESTRICTION_EXPIRY",
      idempotencyKey: `cron_restriction_expiry_${currentHourKey}`,
      priority: 5,
      maxAttempts: 3,
      backoffSeconds: 60,
    }),
    // Backfill missed completion events safely. The worker derives eligibility
    // from confirmed, checked-out booking/listing data and is idempotent.
    jobQueueService.enqueueJob({
      type: "ACHIEVEMENT_RECONCILIATION",
      payload: { mode: "TRAVEL_STAMP_AWARDS", limit: 100 },
      idempotencyKey: `cron_travel_stamp_awards_${currentHourKey}`,
      priority: 4,
      maxAttempts: 3,
      backoffSeconds: 60,
    }),
  ]);

  // 2. Process batch of due jobs, CMS actions, and Saudi licence expiry.
  // Expiry is independently safe to re-run and has a distributed lease.
  const [batchResult, cmsScheduleResult, licenseExpiryResult] = await Promise.all([
    jobQueueService.runBatch({ batchSize: 20 }),
    (async () => {
      try {
        const { cmsSchedulerService } = await import("@/services/cms-scheduler.service");
        return await cmsSchedulerService.executeDueScheduledActions();
      } catch (err) {
        console.warn("[cron] CMS scheduler execution warning:", err);
        return { totalProcessed: 0, succeeded: 0, failed: 0, actions: [] };
      }
    })(),
    saudiLicenseService.enforceExpiry().catch((err) => {
      console.warn("[cron] Saudi license expiry execution warning:", err);
      return { checked: 0, unlisted: 0, skipped: false };
    }),
  ]);
  const stats = await jobQueueService.getQueueStats();

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    processed: batchResult.processed,
    completed: batchResult.completed,
    failed: batchResult.failed,
    retried: batchResult.retried,
    durationMs: batchResult.durationMs,
    cmsScheduledProcessed: cmsScheduleResult.totalProcessed,
    cmsScheduledSucceeded: cmsScheduleResult.succeeded,
    saudiLicensesChecked: licenseExpiryResult.checked,
    saudiListingsUnlisted: licenseExpiryResult.unlisted,
    jobs: batchResult.jobs,
    queueStats: stats,
  });
}
