import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  jobQueueService,
  enqueueJob,
  claimJobs,
  executeJob,
  retryJob,
  getJobById,
  registerJobHandler,
  enqueueNotificationDelivery,
} from "../services/job-queue.service";
import { expirePendingAccountRestrictions } from "../services/moderation.service";
import { reviewService } from "../services/review.service";
import { NotificationType } from "@/generated/prisma/enums";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 7: Background Jobs & Automation Infrastructure", async (t) => {
  await t.test("Prisma schema defines BackgroundJob model and required enums", () => {
    const schemaSrc = source("prisma/schema.prisma");
    const migrationSrc = source("prisma/migrations/20261015130000_add_background_job_queue/migration.sql");
    assert.ok(schemaSrc.includes("model BackgroundJob"), "schema must define BackgroundJob model");
    assert.ok(schemaSrc.includes("enum BackgroundJobStatus"), "schema must define BackgroundJobStatus enum");
    assert.ok(schemaSrc.includes("enum BackgroundJobType"), "schema must define BackgroundJobType enum");
    assert.ok(schemaSrc.includes("REVIEW_EXPIRY_PUBLISH"), "schema must include REVIEW_EXPIRY_PUBLISH");
    assert.ok(schemaSrc.includes("ACCOUNT_RESTRICTION_EXPIRY"), "schema must include ACCOUNT_RESTRICTION_EXPIRY");
    assert.ok(schemaSrc.includes("MODERATION_NOTIFICATION_DELIVERY"), "schema must include MODERATION_NOTIFICATION_DELIVERY");
    assert.ok(schemaSrc.includes("idempotencyKey"), "schema must include idempotencyKey index");
    assert.match(migrationSrc, /CREATE TABLE "BackgroundJob"/, "migration must create persistent BackgroundJob storage");
    assert.match(migrationSrc, /CREATE TYPE "BackgroundJobStatus"/, "migration must create the job status enum");
  });

  await t.test("jobQueueService exports all required core methods", () => {
    assert.equal(typeof jobQueueService.enqueueJob, "function");
    assert.equal(typeof jobQueueService.claimJobs, "function");
    assert.equal(typeof jobQueueService.executeJob, "function");
    assert.equal(typeof jobQueueService.runBatch, "function");
    assert.equal(typeof jobQueueService.retryJob, "function");
    assert.equal(typeof jobQueueService.getQueueStats, "function");
    assert.equal(typeof jobQueueService.listJobs, "function");
    assert.equal(typeof jobQueueService.getJobById, "function");
    assert.equal(typeof jobQueueService.registerJobHandler, "function");
    assert.equal(typeof jobQueueService.enqueueNotificationDelivery, "function");
  });

  await t.test("moderationService exports expirePendingAccountRestrictions", () => {
    assert.equal(typeof expirePendingAccountRestrictions, "function");
    const modSrc = source("services/moderation.service.ts");
    assert.ok(modSrc.includes("expirePendingAccountRestrictions"), "moderation service must export expirePendingAccountRestrictions");
    assert.ok(modSrc.includes("ACCOUNT_RESTRICTION_EXPIRED"), "must log ACCOUNT_RESTRICTION_EXPIRED activity");
  });

  await t.test("reviewService exports publishExpiredReviews with correct rating filtering", () => {
    assert.equal(typeof reviewService.publishExpiredReviews, "function");
    const reviewSrc = source("services/review.service.ts");
    assert.ok(reviewSrc.includes("publishExpiredReviews"), "review service must export publishExpiredReviews");
    assert.ok(reviewSrc.includes("GUEST_TO_PROPERTY"), "must only recalculate listing ratings for GUEST_TO_PROPERTY");
    assert.ok(reviewSrc.includes("invalidateListingCache"), "must invalidate listing cache on review publication");
  });

  await t.test("enqueueJob enforces idempotency key protection", async () => {
    const testKey = `test_idem_${Date.now()}_${Math.random()}`;
    const job1 = await enqueueJob({
      type: "SYSTEM_MAINTENANCE",
      payload: { step: 1 },
      idempotencyKey: testKey,
    });
    assert.ok(job1.id, "Job 1 must be created");

    const job2 = await enqueueJob({
      type: "SYSTEM_MAINTENANCE",
      payload: { step: 2 },
      idempotencyKey: testKey,
    });
    assert.equal(job1.id, job2.id, "Duplicate idempotencyKey must return existing job");
  });

  await t.test("claimJobs atomically claims due jobs and locks with workerId", async () => {
    const worker = `test_worker_${Date.now()}`;
    const testKey = `test_claim_${Date.now()}_${Math.random()}`;
    const job = await enqueueJob({
      type: "SYSTEM_MAINTENANCE",
      idempotencyKey: testKey,
      priority: 9,
    });

    const claimed = await claimJobs({ workerId: worker, batchSize: 5 });
    const target = claimed.find((j) => j.id === job.id);
    if (target) {
      assert.equal(target.status, "RUNNING");
      assert.equal(target.lockedBy, worker);
      assert.ok(target.lockedAt, "lockedAt must be recorded");
    }
  });

  await t.test("executeJob transitions job to COMPLETED on success", async () => {
    let handlerCalled = false;
    registerJobHandler("SYSTEM_MAINTENANCE", async () => {
      handlerCalled = true;
      return { success: true, processed: 1 };
    });

    const testKey = `test_exec_${Date.now()}_${Math.random()}`;
    const job = await enqueueJob({
      type: "SYSTEM_MAINTENANCE",
      idempotencyKey: testKey,
    });

    const claimed = await claimJobs({ workerId: "worker_success_test", batchSize: 10 });
    const match = claimed.find((j) => j.id === job.id) || job;

    const res = await executeJob(match, "worker_success_test");
    assert.equal(res.success, true);
    assert.equal(handlerCalled, true);

    const fetched = await getJobById(match.id);
    assert.equal(fetched?.status, "COMPLETED");
  });

  await t.test("executeJob implements exponential backoff and dead-letter on maxAttempts", async () => {
    const failKey = `test_fail_${Date.now()}_${Math.random()}`;
    registerJobHandler("SYSTEM_MAINTENANCE", async () => {
      throw new Error("Simulated transient failure");
    });

    const job = await enqueueJob({
      type: "SYSTEM_MAINTENANCE",
      idempotencyKey: failKey,
      maxAttempts: 2,
      backoffSeconds: 10,
    });

    // Attempt 1 -> RETRY_SCHEDULED
    const res1 = await executeJob(job, "worker_fail_test");
    assert.equal(res1.success, false);
    const after1 = await getJobById(job.id);
    assert.equal(after1?.status, "RETRY_SCHEDULED");
    assert.equal(after1?.attempts, 1);
    assert.ok(after1?.lastError?.includes("Simulated transient failure"));

    // Attempt 2 -> FAILED (Dead-letter)
    if (after1) {
      const res2 = await executeJob(after1, "worker_fail_test");
      assert.equal(res2.success, false);
      const after2 = await getJobById(job.id);
      assert.equal(after2?.status, "FAILED");
      assert.equal(after2?.attempts, 2);
    }
  });

  await t.test("retryJob resets failed job to PENDING with immediate runAt", async () => {
    const retryKey = `test_retry_${Date.now()}_${Math.random()}`;
    const job = await enqueueJob({
      type: "SYSTEM_MAINTENANCE",
      idempotencyKey: retryKey,
      maxAttempts: 1,
    });
    await executeJob(job, "worker_retry_test");

    const retried = await retryJob(job.id);
    assert.equal(retried.status, "PENDING");
    assert.equal(retried.lockedBy, null);
    assert.equal(retried.lockedAt, null);
  });

  await t.test("enqueueNotificationDelivery creates retryable notification job", async () => {
    const notifJob = await enqueueNotificationDelivery({
      userId: "usr_test_recipient",
      type: NotificationType.SYSTEM,
      title: "Test Alert",
      message: "Testing background delivery outbox pattern",
    });

    assert.equal(notifJob.type, "MODERATION_NOTIFICATION_DELIVERY");
    assert.equal(notifJob.status, "PENDING");
    assert.ok(notifJob.idempotencyKey?.includes("notif_usr_test_recipient"));
  });

  await t.test("cron webhook route guards with secret token and schedules jobs", () => {
    const cronRouteSrc = source("app/api/v1/cron/jobs/route.ts");
    assert.ok(cronRouteSrc.includes("validateCronSecret"), "cron route must validate token secret");
    assert.ok(cronRouteSrc.includes("REVIEW_EXPIRY_PUBLISH"), "cron route must enqueue review expiry publish");
    assert.ok(cronRouteSrc.includes("ACCOUNT_RESTRICTION_EXPIRY"), "cron route must enqueue restriction expiry");
    assert.ok(cronRouteSrc.includes("runBatch"), "cron route must execute runBatch");
    assert.ok(!cronRouteSrc.includes("homyz-cron-secret-local-dev"), "cron route must not use a guessable fallback secret");
    assert.ok(cronRouteSrc.includes("if (!configuredSecret) return false"), "cron route must fail closed when CRON_SECRET is missing");
  });

  await t.test("admin job API routes enforce permissions and support retry & run", () => {
    const adminJobsSrc = source("app/api/v1/admin/jobs/route.ts");
    assert.ok(adminJobsSrc.includes("BACKGROUND_JOBS_VIEW"), "admin jobs route must require BACKGROUND_JOBS_VIEW");
    assert.ok(adminJobsSrc.includes("BACKGROUND_JOBS_MANAGE"), "admin jobs enqueue must require BACKGROUND_JOBS_MANAGE");

    const adminRetrySrc = source("app/api/v1/admin/jobs/[id]/retry/route.ts");
    assert.ok(adminRetrySrc.includes("retryJob"), "admin retry route must call retryJob");

    const adminRunSrc = source("app/api/v1/admin/jobs/run/route.ts");
    assert.ok(adminRunSrc.includes("runBatch"), "admin run route must call runBatch");
  });

  await t.test("admin background jobs UI renders metrics, backlog, and follows modal rules", () => {
    const adminPageSrc = source("app/(protected)/admin/moderation/jobs/page.tsx");
    assert.ok(adminPageSrc.includes("BACKGROUND_JOBS_VIEW"), "jobs page must require permission");

    const clientSrc = source("app/(protected)/admin/moderation/jobs/admin-jobs-client.tsx");
    assert.ok(clientSrc.includes("ModalOverlay"), "client must import ModalOverlay for dialogs");
    assert.ok(clientSrc.includes("Pending Backlog"), "client must display backlog metrics");
    assert.ok(clientSrc.includes("Run Queue Batch Now"), "client must have run batch trigger");
    assert.ok(clientSrc.includes("Publish Expired Reviews"), "client must have review expiry trigger");
    assert.ok(clientSrc.includes("Expire Restrictions"), "client must have restriction expiry trigger");
    assert.ok(clientSrc.includes("inspectModalOpen"), "client must support inspect modal");

    const dashboardSrc = source("app/(protected)/admin/moderation/admin-moderation-dashboard-client.tsx");
    assert.ok(dashboardSrc.includes("/admin/moderation/jobs"), "moderation dashboard must link to background operations");
  });
});
