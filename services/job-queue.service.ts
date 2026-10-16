import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { reviewService } from "@/services/review.service";
import { moderationService } from "@/services/moderation.service";
import { notificationService } from "@/services/notification.service";
import { NotificationType } from "@/generated/prisma/enums";

export type BackgroundJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "RETRY_SCHEDULED"
  | "FAILED";

export type BackgroundJobType =
  | "REVIEW_EXPIRY_PUBLISH"
  | "ACCOUNT_RESTRICTION_EXPIRY"
  | "MODERATION_NOTIFICATION_DELIVERY"
  | "AUDIT_LOG_ARCHIVE"
  | "SYSTEM_MAINTENANCE";

export interface BackgroundJobDTO {
  id: string;
  type: BackgroundJobType;
  status: BackgroundJobStatus;
  payload: Record<string, any> | null;
  idempotencyKey: string | null;
  priority: number;
  attempts: number;
  maxAttempts: number;
  backoffSeconds: number;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  errorStack: string | null;
  runAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueJobInput {
  type: BackgroundJobType;
  payload?: Record<string, any> | null;
  idempotencyKey?: string | null;
  runAt?: Date | string | null;
  priority?: number;
  maxAttempts?: number;
  backoffSeconds?: number;
}

export type JobHandler = (job: BackgroundJobDTO) => Promise<any>;

// In-memory registry of job handlers
const handlerRegistry = new Map<BackgroundJobType, JobHandler>();

// In-memory fallback job store for offline testing or disconnected environments
const inMemoryStore = new Map<string, BackgroundJobDTO>();

let isDbAvailable: boolean | null = null;
let lastDbCheck = 0;

async function checkDbAvailable(): Promise<boolean> {
  const now = Date.now();
  if (isDbAvailable !== null && now - lastDbCheck < 60_000) {
    return isDbAvailable;
  }
  lastDbCheck = now;
  try {
    if (!prisma || typeof (prisma as any).backgroundJob === "undefined") {
      isDbAvailable = false;
      return false;
    }
    const probePromise = (prisma as any).backgroundJob.count({ take: 1 });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DB probe timeout")), 800)
    );
    await Promise.race([probePromise, timeoutPromise]);
    isDbAvailable = true;
    return true;
  } catch (err) {
    isDbAvailable = false;
    return false;
  }
}

function toJobDTO(item: any): BackgroundJobDTO {
  return {
    id: item.id,
    type: item.type as BackgroundJobType,
    status: item.status as BackgroundJobStatus,
    payload: (item.payload as Record<string, any>) || null,
    idempotencyKey: item.idempotencyKey || null,
    priority: Number(item.priority || 0),
    attempts: Number(item.attempts || 0),
    maxAttempts: Number(item.maxAttempts || 3),
    backoffSeconds: Number(item.backoffSeconds || 30),
    lockedAt: item.lockedAt ? new Date(item.lockedAt).toISOString() : null,
    lockedBy: item.lockedBy || null,
    lastError: item.lastError || null,
    errorStack: item.errorStack || null,
    runAt: item.runAt ? new Date(item.runAt).toISOString() : new Date().toISOString(),
    startedAt: item.startedAt ? new Date(item.startedAt).toISOString() : null,
    completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : null,
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Register a job handler for a specific BackgroundJobType.
 */
export function registerJobHandler(type: BackgroundJobType, handler: JobHandler) {
  handlerRegistry.set(type, handler);
}

/**
 * Enqueue a new background job or return an existing active job if idempotencyKey matches.
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<BackgroundJobDTO> {
  const runAtDate = input.runAt ? new Date(input.runAt) : new Date();
  const maxAttempts = input.maxAttempts ?? 3;
  const backoffSeconds = input.backoffSeconds ?? 30;
  const priority = input.priority ?? 0;
  const payload = input.payload || {};

  const useDb = await checkDbAvailable();

  if (useDb) {
    try {
      if (input.idempotencyKey) {
        const existing = await (prisma as any).backgroundJob.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existing) {
          // If still pending, running or scheduled to retry, do not duplicate
          if (["PENDING", "RUNNING", "RETRY_SCHEDULED"].includes(existing.status)) {
            return toJobDTO(existing);
          }
          // If already completed or failed, we can update or create a new one
        }
      }

      const created = await (prisma as any).backgroundJob.create({
        data: {
          type: input.type,
          payload: payload as any,
          idempotencyKey: input.idempotencyKey || null,
          priority,
          maxAttempts,
          backoffSeconds,
          runAt: runAtDate,
          status: "PENDING",
        },
      });

      return toJobDTO(created);
    } catch (err: any) {
      // If unique constraint error on idempotencyKey, return existing
      if (err?.code === "P2002" && input.idempotencyKey) {
        const existing = await (prisma as any).backgroundJob.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return toJobDTO(existing);
      }
      console.warn("[job-queue.service] DB enqueue failed, using fallback:", err?.message || err);
    }
  }

  // In-memory fallback
  if (input.idempotencyKey) {
    for (const job of inMemoryStore.values()) {
      if (job.idempotencyKey === input.idempotencyKey) {
        if (["PENDING", "RUNNING", "RETRY_SCHEDULED"].includes(job.status)) {
          return job;
        }
      }
    }
  }

  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const nowStr = new Date().toISOString();
  const memoryJob: BackgroundJobDTO = {
    id,
    type: input.type,
    status: "PENDING",
    payload,
    idempotencyKey: input.idempotencyKey || null,
    priority,
    attempts: 0,
    maxAttempts,
    backoffSeconds,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
    errorStack: null,
    runAt: runAtDate.toISOString(),
    startedAt: null,
    completedAt: null,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  inMemoryStore.set(id, memoryJob);
  return memoryJob;
}

/**
 * Claim due jobs atomically with a worker lease lock.
 */
export async function claimJobs(options: {
  workerId: string;
  batchSize?: number;
  lockDurationMs?: number;
}): Promise<BackgroundJobDTO[]> {
  const { workerId, batchSize = 10, lockDurationMs = 5 * 60 * 1000 } = options;
  const now = new Date();
  const staleLockThreshold = new Date(now.getTime() - lockDurationMs);

  const useDb = await checkDbAvailable();

  if (useDb) {
    try {
      // Find candidate job IDs matching claim conditions:
      // (status = PENDING OR (status = RETRY_SCHEDULED AND runAt <= now) OR (status = RUNNING AND lockedAt <= staleThreshold))
      // and runAt <= now
      const candidates = await (prisma as any).backgroundJob.findMany({
        where: {
          runAt: { lte: now },
          OR: [
            { status: "PENDING" },
            { status: "RETRY_SCHEDULED" },
            { status: "RUNNING", lockedAt: { lte: staleLockThreshold } },
          ],
        },
        orderBy: [{ priority: "desc" }, { runAt: "asc" }, { createdAt: "asc" }],
        take: batchSize,
        select: { id: true },
      });

      if (!candidates.length) return [];

      const candidateIds = candidates.map((c: any) => c.id);

      // Atomic update claim
      await (prisma as any).backgroundJob.updateMany({
        where: {
          id: { in: candidateIds },
          OR: [
            { status: "PENDING" },
            { status: "RETRY_SCHEDULED" },
            { status: "RUNNING", lockedAt: { lte: staleLockThreshold } },
          ],
        },
        data: {
          status: "RUNNING",
          lockedAt: now,
          lockedBy: workerId,
          startedAt: now,
        },
      });

      // Retrieve the successfully locked rows
      const claimed = await (prisma as any).backgroundJob.findMany({
        where: {
          id: { in: candidateIds },
          lockedBy: workerId,
          status: "RUNNING",
        },
      });

      return claimed.map(toJobDTO);
    } catch (err: any) {
      console.warn("[job-queue.service] DB claim failed, fallback to in-memory:", err?.message || err);
    }
  }

  // In-memory claim
  const claimedInMemory: BackgroundJobDTO[] = [];
  for (const job of inMemoryStore.values()) {
    if (claimedInMemory.length >= batchSize) break;

    const isDue = new Date(job.runAt) <= now;
    if (!isDue) continue;

    const isPending = job.status === "PENDING";
    const isRetryDue = job.status === "RETRY_SCHEDULED";
    const isStaleLock =
      job.status === "RUNNING" && job.lockedAt && new Date(job.lockedAt) <= staleLockThreshold;

    if (isPending || isRetryDue || isStaleLock) {
      job.status = "RUNNING";
      job.lockedAt = now.toISOString();
      job.lockedBy = workerId;
      job.startedAt = now.toISOString();
      job.updatedAt = now.toISOString();
      claimedInMemory.push({ ...job });
    }
  }

  return claimedInMemory;
}

/**
 * Execute a single claimed job using its registered handler.
 */
export async function executeJob(
  job: BackgroundJobDTO,
  workerId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  const handler = handlerRegistry.get(job.type);

  if (!handler) {
    const errorMsg = `No registered handler for job type: ${job.type}`;
    await markJobFailed(job, errorMsg, "");
    return { success: false, error: errorMsg };
  }

  try {
    const result = await handler(job);
    await markJobCompleted(job, result);
    return { success: true, result };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const errorStack = err?.stack || "";
    await handleJobFailure(job, errorMsg, errorStack);
    return { success: false, error: errorMsg };
  }
}

async function markJobCompleted(job: BackgroundJobDTO, result: any) {
  const now = new Date();
  const useDb = await checkDbAvailable();

  if (useDb) {
    try {
      await (prisma as any).backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          errorStack: null,
        },
      });
      return;
    } catch (err) {
      console.warn("[job-queue.service] DB markJobCompleted failed:", err);
    }
  }

  const inMem = inMemoryStore.get(job.id);
  if (inMem) {
    inMem.status = "COMPLETED";
    inMem.completedAt = now.toISOString();
    inMem.lockedAt = null;
    inMem.lockedBy = null;
    inMem.lastError = null;
    inMem.errorStack = null;
    inMem.updatedAt = now.toISOString();
  }
}

async function markJobFailed(
  job: BackgroundJobDTO,
  errorMsg: string,
  errorStack: string,
  attempts?: number
) {
  const resolvedAttempts = attempts ?? (job.attempts + 1);
  const now = new Date();
  const useDb = await checkDbAvailable();

  if (useDb) {
    try {
      await (prisma as any).backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          attempts: resolvedAttempts,
          lockedAt: null,
          lockedBy: null,
          lastError: errorMsg,
          errorStack,
          completedAt: null,
        },
      });
      return;
    } catch (err) {
      console.warn("[job-queue.service] DB markJobFailed failed:", err);
    }
  }

  const inMem = inMemoryStore.get(job.id);
  if (inMem) {
    inMem.status = "FAILED";
    inMem.attempts = resolvedAttempts;
    inMem.lockedAt = null;
    inMem.lockedBy = null;
    inMem.lastError = errorMsg;
    inMem.errorStack = errorStack;
    inMem.updatedAt = now.toISOString();
  }
}

async function handleJobFailure(job: BackgroundJobDTO, errorMsg: string, errorStack: string) {
  const attempts = job.attempts + 1;
  const now = new Date();

  if (attempts >= job.maxAttempts) {
    // Dead letter state
    await markJobFailed(job, errorMsg, errorStack, attempts);
    return;
  }

  // Calculate exponential backoff with jitter
  // backoff = min(3600, backoffSeconds * 2^(attempts-1)) + random jitter (0-5s)
  const baseBackoff = Math.min(3600, job.backoffSeconds * Math.pow(2, attempts - 1));
  const jitter = Math.floor(Math.random() * 5);
  const nextRunAt = new Date(now.getTime() + (baseBackoff + jitter) * 1000);

  const useDb = await checkDbAvailable();
  if (useDb) {
    try {
      await (prisma as any).backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "RETRY_SCHEDULED",
          attempts,
          runAt: nextRunAt,
          lockedAt: null,
          lockedBy: null,
          lastError: errorMsg,
          errorStack,
        },
      });
      return;
    } catch (err) {
      console.warn("[job-queue.service] DB handleJobFailure failed:", err);
    }
  }

  const inMem = inMemoryStore.get(job.id);
  if (inMem) {
    inMem.status = "RETRY_SCHEDULED";
    inMem.attempts = attempts;
    inMem.runAt = nextRunAt.toISOString();
    inMem.lockedAt = null;
    inMem.lockedBy = null;
    inMem.lastError = errorMsg;
    inMem.errorStack = errorStack;
    inMem.updatedAt = now.toISOString();
  }
}

/**
 * Run a batch of claimed jobs.
 */
export async function runBatch(options: {
  workerId?: string;
  batchSize?: number;
}): Promise<{
  processed: number;
  completed: number;
  failed: number;
  retried: number;
  durationMs: number;
  jobs: Array<{ id: string; type: BackgroundJobType; success: boolean }>;
}> {
  const startTime = Date.now();
  const workerId = options.workerId || `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
  const batchSize = options.batchSize || 10;

  const claimed = await claimJobs({ workerId, batchSize });
  if (!claimed.length) {
    return {
      processed: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      durationMs: Date.now() - startTime,
      jobs: [],
    };
  }

  let completed = 0;
  let failed = 0;
  let retried = 0;
  const jobResults: Array<{ id: string; type: BackgroundJobType; success: boolean }> = [];

  for (const job of claimed) {
    const res = await executeJob(job, workerId);
    if (res.success) {
      completed++;
    } else {
      if (job.attempts + 1 >= job.maxAttempts) {
        failed++;
      } else {
        retried++;
      }
    }
    jobResults.push({ id: job.id, type: job.type, success: res.success });
  }

  return {
    processed: claimed.length,
    completed,
    failed,
    retried,
    durationMs: Date.now() - startTime,
    jobs: jobResults,
  };
}

/**
 * Manually retry a failed or stuck job (authorized admin operation).
 */
export async function retryJob(jobId: string, actor?: AuthUser): Promise<BackgroundJobDTO> {
  const now = new Date();
  const useDb = await checkDbAvailable();

  if (useDb) {
    const existing = await (prisma as any).backgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!existing) throw AppError.notFound("Background job not found.");

    const updated = await (prisma as any).backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        runAt: now,
        lockedAt: null,
        lockedBy: null,
      },
    });

    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: "BACKGROUND_JOB_RETRY",
          resourceType: "BACKGROUND_JOB",
          resourceId: jobId,
          description: `Background job ${jobId} (${existing.type}) manually retried by admin ${actor.email}`,
          metadata: { jobId, type: existing.type },
        },
      }).catch((err: any) => console.warn("[job-queue.service] Failed to create audit log for job retry:", err));
    }

    return toJobDTO(updated);
  }

  const inMem = inMemoryStore.get(jobId);
  if (!inMem) throw AppError.notFound("Background job not found.");

  inMem.status = "PENDING";
  inMem.runAt = now.toISOString();
  inMem.lockedAt = null;
  inMem.lockedBy = null;
  inMem.updatedAt = now.toISOString();

  return { ...inMem };
}

/**
 * Get queue metrics, backlog counts, and health status.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  running: number;
  retryScheduled: number;
  failed: number;
  completed: number;
  totalBacklog: number;
  oldestPendingJobAgeSeconds: number;
  health: "HEALTHY" | "DEGRADED" | "BACKLOGGED";
}> {
  const now = new Date();
  const useDb = await checkDbAvailable();

  if (useDb) {
    try {
      const [pending, running, retryScheduled, failed, completed, oldestPending] = await Promise.all([
        (prisma as any).backgroundJob.count({ where: { status: "PENDING" } }),
        (prisma as any).backgroundJob.count({ where: { status: "RUNNING" } }),
        (prisma as any).backgroundJob.count({ where: { status: "RETRY_SCHEDULED" } }),
        (prisma as any).backgroundJob.count({ where: { status: "FAILED" } }),
        (prisma as any).backgroundJob.count({ where: { status: "COMPLETED" } }),
        (prisma as any).backgroundJob.findFirst({
          where: { status: "PENDING" },
          orderBy: { runAt: "asc" },
          select: { runAt: true },
        }),
      ]);

      const totalBacklog = pending + retryScheduled;
      const oldestPendingJobAgeSeconds = oldestPending?.runAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(oldestPending.runAt).getTime()) / 1000))
        : 0;

      let health: "HEALTHY" | "DEGRADED" | "BACKLOGGED" = "HEALTHY";
      if (failed > 10 || oldestPendingJobAgeSeconds > 3600) {
        health = "DEGRADED";
      } else if (totalBacklog > 100) {
        health = "BACKLOGGED";
      }

      return {
        pending,
        running,
        retryScheduled,
        failed,
        completed,
        totalBacklog,
        oldestPendingJobAgeSeconds,
        health,
      };
    } catch (err) {
      console.warn("[job-queue.service] DB getQueueStats failed, fallback to memory:", err);
    }
  }

  // Fallback in-memory
  let pending = 0;
  let running = 0;
  let retryScheduled = 0;
  let failed = 0;
  let completed = 0;
  let oldestPendingTime: number | null = null;

  for (const job of inMemoryStore.values()) {
    if (job.status === "PENDING") {
      pending++;
      const time = new Date(job.runAt).getTime();
      if (oldestPendingTime === null || time < oldestPendingTime) {
        oldestPendingTime = time;
      }
    } else if (job.status === "RUNNING") {
      running++;
    } else if (job.status === "RETRY_SCHEDULED") {
      retryScheduled++;
    } else if (job.status === "FAILED") {
      failed++;
    } else if (job.status === "COMPLETED") {
      completed++;
    }
  }

  const totalBacklog = pending + retryScheduled;
  const oldestPendingJobAgeSeconds = oldestPendingTime
    ? Math.max(0, Math.floor((now.getTime() - oldestPendingTime) / 1000))
    : 0;

  let health: "HEALTHY" | "DEGRADED" | "BACKLOGGED" = "HEALTHY";
  if (failed > 10 || oldestPendingJobAgeSeconds > 3600) {
    health = "DEGRADED";
  } else if (totalBacklog > 100) {
    health = "BACKLOGGED";
  }

  return {
    pending,
    running,
    retryScheduled,
    failed,
    completed,
    totalBacklog,
    oldestPendingJobAgeSeconds,
    health,
  };
}

/**
 * List jobs with filtering, pagination and sorting.
 */
export async function listJobs(options: {
  status?: BackgroundJobStatus | "ALL";
  type?: BackgroundJobType | "ALL";
  page?: number;
  limit?: number;
}): Promise<{
  jobs: BackgroundJobDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const skip = (page - 1) * limit;

  const whereClause: any = {};
  if (options.status && options.status !== "ALL") {
    whereClause.status = options.status;
  }
  if (options.type && options.type !== "ALL") {
    whereClause.type = options.type;
  }

  const useDb = await checkDbAvailable();

  if (useDb) {
    try {
      const [total, items] = await Promise.all([
        (prisma as any).backgroundJob.count({ where: whereClause }),
        (prisma as any).backgroundJob.findMany({
          where: whereClause,
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: limit,
        }),
      ]);

      return {
        jobs: items.map(toJobDTO),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    } catch (err) {
      console.warn("[job-queue.service] DB listJobs failed, fallback to memory:", err);
    }
  }

  // Memory list
  let filtered = Array.from(inMemoryStore.values());
  if (options.status && options.status !== "ALL") {
    filtered = filtered.filter((j) => j.status === options.status);
  }
  if (options.type && options.type !== "ALL") {
    filtered = filtered.filter((j) => j.type === options.type);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const paged = filtered.slice(skip, skip + limit);

  return {
    jobs: paged,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Get job by ID.
 */
export async function getJobById(jobId: string): Promise<BackgroundJobDTO | null> {
  const useDb = await checkDbAvailable();
  if (useDb) {
    try {
      const item = await (prisma as any).backgroundJob.findUnique({
        where: { id: jobId },
      });
      return item ? toJobDTO(item) : null;
    } catch (err) {
      console.warn("[job-queue.service] DB getJobById failed:", err);
    }
  }

  const inMem = inMemoryStore.get(jobId);
  return inMem ? { ...inMem } : null;
}

/**
 * Helper to enqueue reliable notification delivery via outbox pattern.
 */
export async function enqueueNotificationDelivery(payload: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string | null;
  entityType?: string | null;
  link?: string | null;
  metadata?: Record<string, any>;
}): Promise<BackgroundJobDTO> {
  const idempotencyKey = `notif_${payload.userId}_${payload.entityType || "general"}_${payload.entityId || Date.now()}`;
  return enqueueJob({
    type: "MODERATION_NOTIFICATION_DELIVERY",
    payload,
    idempotencyKey,
    priority: 1, // higher priority for notifications
    maxAttempts: 5,
    backoffSeconds: 15,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Handler Implementations
// ─────────────────────────────────────────────────────────────────────────────

// 1. REVIEW_EXPIRY_PUBLISH
registerJobHandler("REVIEW_EXPIRY_PUBLISH", async (job) => {
  const now = new Date();
  const publishedCount = await reviewService.publishExpiredReviews(now);
  return { publishedCount, executedAt: now.toISOString() };
});

// 2. ACCOUNT_RESTRICTION_EXPIRY
registerJobHandler("ACCOUNT_RESTRICTION_EXPIRY", async (job) => {
  const result = await moderationService.expirePendingAccountRestrictions();
  return result;
});

// 3. MODERATION_NOTIFICATION_DELIVERY
registerJobHandler("MODERATION_NOTIFICATION_DELIVERY", async (job) => {
  const p = job.payload || {};
  if (!p.userId || !p.title || !p.message) {
    throw new Error("Missing required fields for notification delivery");
  }

  const notif = await notificationService.create({
    userId: p.userId,
    type: p.type || NotificationType.SYSTEM,
    title: p.title,
    message: p.message,
    entityId: p.entityId || null,
    entityType: p.entityType || null,
    link: p.link || null,
    metadata: p.metadata || {},
  });

  return { notificationId: notif.id, deliveredTo: p.userId };
});

// 4. AUDIT_LOG_ARCHIVE / SYSTEM_MAINTENANCE
registerJobHandler("SYSTEM_MAINTENANCE", async (job) => {
  // Clean up completed jobs older than 14 days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const useDb = await checkDbAvailable();
  let deletedCount = 0;
  if (useDb) {
    try {
      const res = await (prisma as any).backgroundJob.deleteMany({
        where: {
          status: "COMPLETED",
          completedAt: { lte: cutoff },
        },
      });
      deletedCount = res.count;
    } catch (e) {
      // ignore
    }
  } else {
    for (const [id, j] of inMemoryStore.entries()) {
      if (j.status === "COMPLETED" && j.completedAt && new Date(j.completedAt) <= cutoff) {
        inMemoryStore.delete(id);
        deletedCount++;
      }
    }
  }
  return { purgedJobsCount: deletedCount };
});

export const jobQueueService = {
  enqueueJob,
  claimJobs,
  executeJob,
  runBatch,
  retryJob,
  getQueueStats,
  listJobs,
  getJobById,
  registerJobHandler,
  enqueueNotificationDelivery,
};

