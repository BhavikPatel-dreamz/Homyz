import { prisma } from "@/lib/db/prisma";

/** Bounded, payload-minimised view over the existing durable job queue. */
export async function getLoyaltyDeliveryDiagnostics(limit = 50) {
  const take = Math.min(100, Math.max(1, limit));
  const jobs = await prisma.backgroundJob.findMany({
    where: { type: "MODERATION_NOTIFICATION_DELIVERY" },
    select: { id: true, status: true, attempts: true, maxAttempts: true, lastError: true, createdAt: true, completedAt: true, runAt: true, payload: true, idempotencyKey: true },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  const loyalty = jobs.filter((job) => {
    const payload = job.payload as Record<string, unknown> | null;
    const metadata = payload?.metadata as Record<string, unknown> | undefined;
    return typeof metadata?.loyaltyEvent === "string";
  }).slice(0, take).map((job) => {
    const payload = job.payload as Record<string, unknown> | null;
    const metadata = payload?.metadata as Record<string, unknown> | undefined;
    return { id: job.id, status: job.status, attempts: job.attempts, maxAttempts: job.maxAttempts, lastError: job.lastError ? "DELIVERY_PROCESSING_FAILED" : null, createdAt: job.createdAt, completedAt: job.completedAt, runAt: job.runAt, idempotencyKey: job.idempotencyKey, category: metadata?.loyaltyEvent ?? null, channel: "IN_APP" as const };
  });
  return { items: loyalty, scanned: jobs.length, bounded: jobs.length === 100 };
}
