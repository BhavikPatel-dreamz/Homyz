import { enqueueNotificationDelivery } from "@/services/job-queue.service";
import { buildLoyaltyNotification, type LoyaltyNotificationCandidate } from "@/lib/stayelite/notification-catalog";

/**
 * Queues an in-app notification plus a separate activity projection. The
 * existing BackgroundJob retry/idempotency machinery is the single delivery
 * path; no source transaction waits on delivery.
 */
export async function enqueueLoyaltyNotification(candidate: LoyaltyNotificationCandidate) {
  const notification = buildLoyaltyNotification(candidate);
  return enqueueNotificationDelivery({
    ...notification,
    idempotencyKey: notification.deduplicationKey,
    loyaltyActivity: { type: notification.activityType, eventKey: notification.deduplicationKey, summary: notification.summary, sourceType: candidate.sourceType, sourceId: candidate.sourceId, occurredAt: (candidate.occurredAt ?? new Date()).toISOString() },
  });
}
