import "server-only";

import { nanoid } from "nanoid";
import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { isEmailDeliveryConfigured, sendOperationalNotificationEmail } from "@/lib/services/email";
import { notificationService } from "@/services/notification.service";
import { NotificationDeliveryChannel, NotificationDeliveryStatus, NotificationOutboxStatus, NotificationType } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";

const DEFAULT_MAX_ATTEMPTS = 5;
const LEASE_MS = 90_000;
const MAX_BATCH_SIZE = 50;

export type OutboxRecipient = { userId: string; title: string; message: string; link?: string | null; type?: NotificationType };
export type SupportNotificationOutboxInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  idempotencyKey: string;
  recipients: OutboxRecipient[];
  eventVersion?: number;
};

type Payload = { recipients: OutboxRecipient[] };

function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function supportEmail(recipient: OutboxRecipient) {
  // Outbox links are generated on the server. Accept only an application path
  // here so a future producer cannot turn operational email into an open link.
  const path = recipient.link?.startsWith("/") ? recipient.link : null;
  const url = path ? new URL(path, process.env.APP_URL ?? "http://localhost:3000").toString() : null;
  const text = [
    "StayElite Support",
    "",
    recipient.message,
    ...(url ? ["", `View your support update: ${url}`] : []),
    "",
    "This is an operational support notification. Do not reply with sensitive evidence by email.",
  ].join("\n");
  const title = escapeEmailHtml(recipient.title);
  const message = escapeEmailHtml(recipient.message).replace(/\n/g, "<br />");
  const action = url
    ? `<p style="margin:24px 0"><a href="${escapeEmailHtml(url)}" style="display:inline-block;background:#18181b;border-radius:8px;color:#fff;padding:10px 16px;text-decoration:none">View support update</a></p>`
    : "";
  const html = `<main style="max-width:560px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#18181b"><p style="font-weight:700">StayElite Support</p><h1 style="font-size:20px">${title}</h1><p style="line-height:1.6">${message}</p>${action}<p style="border-top:1px solid #e4e4e7;padding-top:16px;color:#71717a;font-size:12px">This is an operational support notification. Do not reply with sensitive evidence by email.</p></main>`;
  return { subject: `StayElite Support: ${recipient.title}`, text, html };
}

function cleanRecipients(recipients: OutboxRecipient[]) {
  const deduplicated = new Map<string, OutboxRecipient>();
  for (const item of recipients) {
    if (!item.userId || !item.title?.trim() || !item.message?.trim()) continue;
    // Notification text is bounded to make accidental private-content payloads
    // both less likely and operationally manageable.
    deduplicated.set(item.userId, { ...item, title: item.title.trim().slice(0, 240), message: item.message.trim().slice(0, 2_000) });
  }
  return [...deduplicated.values()];
}

export async function enqueueSupportNotification(
  tx: Prisma.TransactionClient,
  input: SupportNotificationOutboxInput,
) {
  const recipients = cleanRecipients(input.recipients);
  if (!recipients.length) return null;
  return tx.notificationOutbox.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      eventVersion: input.eventVersion ?? 1,
      payload: { recipients } as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    },
    update: {},
  });
}

function retryDelayMs(attempt: number) {
  return Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.max(0, attempt - 1)));
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message.startsWith("EMAIL_PROVIDER_REJECTED:")) return "EMAIL_REJECTED";
  if (message.includes("EMAIL_PROVIDER_NOT_CONFIGURED")) return "EMAIL_NOT_CONFIGURED";
  if (/timeout|timed out|network|ECONN/i.test(message)) return "AMBIGUOUS_PROVIDER_OUTCOME";
  return "DELIVERY_FAILED";
}

async function recoverStaleLeases(now: Date) {
  return prisma.notificationOutbox.updateMany({
    where: { status: NotificationOutboxStatus.PROCESSING, leaseExpiresAt: { lt: now } },
    data: { status: NotificationOutboxStatus.RETRY_PENDING, processingLeaseId: null, leaseExpiresAt: null, nextAttemptAt: now, lastErrorCode: "LEASE_EXPIRED", lastError: "Worker lease expired before completion." },
  });
}

async function claimOne(id: string, now: Date) {
  const leaseId = nanoid(18);
  const claimed = await prisma.notificationOutbox.updateMany({
    where: {
      id,
      status: { in: [NotificationOutboxStatus.PENDING, NotificationOutboxStatus.RETRY_PENDING] },
      nextAttemptAt: { lte: now },
    },
    data: { status: NotificationOutboxStatus.PROCESSING, processingLeaseId: leaseId, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), attemptCount: { increment: 1 } },
  });
  if (claimed.count !== 1) return null;
  return prisma.notificationOutbox.findUnique({ where: { id }, include: { deliveries: true } });
}

async function recordAttempt(deliveryId: string, attemptNumber: number, status: NotificationDeliveryStatus, details?: { errorCode?: string; errorMessage?: string; providerId?: string | null }) {
  await prisma.notificationDeliveryAttempt.upsert({
    where: { deliveryId_attemptNumber: { deliveryId, attemptNumber } },
    create: { deliveryId, attemptNumber, status, errorCode: details?.errorCode, errorMessage: details?.errorMessage?.slice(0, 2_000), providerId: details?.providerId ?? null },
    update: { status, errorCode: details?.errorCode, errorMessage: details?.errorMessage?.slice(0, 2_000), providerId: details?.providerId ?? null },
  });
}

async function deliverInApp(event: { id: string; eventType: string; entityId: string; entityType: string }, recipient: OutboxRecipient) {
  const delivery = await prisma.notificationDelivery.upsert({
    where: { outboxEventId_recipientUserId_channel: { outboxEventId: event.id, recipientUserId: recipient.userId, channel: NotificationDeliveryChannel.IN_APP } },
    create: { outboxEventId: event.id, recipientUserId: recipient.userId, channel: NotificationDeliveryChannel.IN_APP },
    update: {},
  });
  if (delivery.status === NotificationDeliveryStatus.DELIVERED) return;
  const attempt = delivery.attemptCount + 1;
  try {
    const notification = await notificationService.create({
      userId: recipient.userId,
      type: recipient.type ?? NotificationType.SYSTEM,
      title: recipient.title,
      message: recipient.message,
      entityId: event.entityId,
      entityType: `outbox:${event.eventType}`,
      link: recipient.link ?? null,
      metadata: { outboxEventId: event.id, entityType: event.entityType, entityId: event.entityId },
      deduplicationKey: `outbox:${event.id}:in-app:${recipient.userId}`,
    });
    await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { notificationId: notification.id, status: NotificationDeliveryStatus.DELIVERED, attemptCount: attempt, lastAttemptedAt: new Date(), deliveredAt: new Date(), failureReason: null } });
    await recordAttempt(delivery.id, attempt, NotificationDeliveryStatus.DELIVERED);
  } catch (error) {
    const code = errorCode(error);
    await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: NotificationDeliveryStatus.RETRY_PENDING, attemptCount: attempt, lastAttemptedAt: new Date(), failureReason: code } });
    await recordAttempt(delivery.id, attempt, NotificationDeliveryStatus.RETRY_PENDING, { errorCode: code, errorMessage: error instanceof Error ? error.message : "Unknown in-app failure" });
    throw error;
  }
}

async function deliverEmail(event: { id: string }, recipient: OutboxRecipient) {
  if (!isEmailDeliveryConfigured()) return;
  const user = await prisma.user.findUnique({ where: { id: recipient.userId }, select: { email: true, status: true } });
  if (!user?.email || user.status !== "ACTIVE") return;
  const delivery = await prisma.notificationDelivery.upsert({
    where: { outboxEventId_recipientUserId_channel: { outboxEventId: event.id, recipientUserId: recipient.userId, channel: NotificationDeliveryChannel.EMAIL } },
    create: { outboxEventId: event.id, recipientUserId: recipient.userId, channel: NotificationDeliveryChannel.EMAIL },
    update: {},
  });
  if (
    delivery.status === NotificationDeliveryStatus.SENT ||
    delivery.status === NotificationDeliveryStatus.DELIVERED ||
    delivery.status === NotificationDeliveryStatus.PERMANENTLY_FAILED
  ) return;
  const attempt = delivery.attemptCount + 1;
  await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: NotificationDeliveryStatus.SENDING, attemptCount: attempt, lastAttemptedAt: new Date() } });
  try {
    const result = await sendOperationalNotificationEmail({ to: user.email, ...supportEmail(recipient) });
    await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: NotificationDeliveryStatus.SENT, providerMessageId: result.providerMessageId, sentAt: new Date(), failureReason: null } });
    await recordAttempt(delivery.id, attempt, NotificationDeliveryStatus.SENT, { providerId: result.providerMessageId });
  } catch (error) {
    const code = errorCode(error);
    // A network timeout can have been accepted upstream. Do not automatically
    // resend an ambiguous request; dead-letter it for provider reconciliation.
    const permanent = code === "AMBIGUOUS_PROVIDER_OUTCOME" || code === "EMAIL_REJECTED";
    await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: permanent ? NotificationDeliveryStatus.PERMANENTLY_FAILED : NotificationDeliveryStatus.RETRY_PENDING, failureReason: code } });
    await recordAttempt(delivery.id, attempt, permanent ? NotificationDeliveryStatus.PERMANENTLY_FAILED : NotificationDeliveryStatus.RETRY_PENDING, { errorCode: code, errorMessage: error instanceof Error ? error.message : "Email failure" });
    throw error;
  }
}

async function processClaimed(event: { id: string; eventType: string; entityId: string; entityType: string; attemptCount: number; maxAttempts: number; processingLeaseId: string | null; payload: Prisma.JsonValue }) {
  const payload = event.payload as Payload;
  try {
    for (const recipient of cleanRecipients(payload.recipients || [])) {
      await deliverInApp(event, recipient);
      await deliverEmail(event, recipient);
    }
    await prisma.notificationOutbox.updateMany({ where: { id: event.id, status: NotificationOutboxStatus.PROCESSING, processingLeaseId: event.processingLeaseId }, data: { status: NotificationOutboxStatus.DELIVERED, processedAt: new Date(), processingLeaseId: null, leaseExpiresAt: null, lastErrorCode: null, lastError: null } });
    return "delivered" as const;
  } catch (error) {
    const code = errorCode(error);
    const dead = event.attemptCount >= event.maxAttempts || code === "AMBIGUOUS_PROVIDER_OUTCOME" || code === "EMAIL_REJECTED";
    await prisma.notificationOutbox.updateMany({ where: { id: event.id, status: NotificationOutboxStatus.PROCESSING, processingLeaseId: event.processingLeaseId }, data: { status: dead ? NotificationOutboxStatus.DEAD_LETTER : NotificationOutboxStatus.RETRY_PENDING, nextAttemptAt: dead ? new Date() : new Date(Date.now() + retryDelayMs(event.attemptCount)), processingLeaseId: null, leaseExpiresAt: null, lastErrorCode: code, lastError: (error instanceof Error ? error.message : "Unknown delivery failure").slice(0, 2_000) } });
    return dead ? "deadLetter" as const : "retry" as const;
  }
}

export async function processNotificationOutboxBatch(options: { limit?: number } = {}) {
  const now = new Date();
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.trunc(options.limit ?? 25)));
  const recovered = await recoverStaleLeases(now);
  const candidates = await prisma.notificationOutbox.findMany({ where: { status: { in: [NotificationOutboxStatus.PENDING, NotificationOutboxStatus.RETRY_PENDING] }, nextAttemptAt: { lte: now } }, select: { id: true }, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }], take: limit });
  const result = { recovered: recovered.count, claimed: 0, delivered: 0, retryPending: 0, deadLetter: 0 };
  for (const candidate of candidates) {
    const claimed = await claimOne(candidate.id, now);
    if (!claimed) continue;
    result.claimed += 1;
    const outcome = await processClaimed(claimed);
    if (outcome === "delivered") result.delivered += 1;
    if (outcome === "retry") result.retryPending += 1;
    if (outcome === "deadLetter") result.deadLetter += 1;
  }
  return result;
}

export async function getNotificationOutboxSummary(options: { status?: NotificationDeliveryStatus; page?: number } = {}) {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const take = 25;
  const deliveryWhere = options.status ? { status: options.status } : {};
  const [counts, deliveryCounts, failedDeliveries, deliveryTotal, deliveries, recent] = await Promise.all([
    prisma.notificationOutbox.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.notificationDelivery.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.notificationDelivery.count({ where: { status: { in: [NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.PERMANENTLY_FAILED, NotificationDeliveryStatus.RETRY_PENDING] } } }),
    prisma.notificationDelivery.count({ where: deliveryWhere }),
    prisma.notificationDelivery.findMany({
      where: deliveryWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      select: {
        id: true, channel: true, status: true, attemptCount: true, failureReason: true, createdAt: true, lastAttemptedAt: true,
        recipient: { select: { id: true, name: true, email: true } },
        outboxEvent: { select: { id: true, eventType: true, entityType: true, entityId: true, status: true } },
      },
    }),
    prisma.notificationOutbox.findMany({ orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, eventType: true, entityType: true, entityId: true, status: true, attemptCount: true, maxAttempts: true, lastErrorCode: true, updatedAt: true } }),
  ]);
  return {
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    deliveryCounts: Object.fromEntries(deliveryCounts.map((row) => [row.status, row._count._all])),
    failedDeliveries,
    deliveries,
    pagination: { page, take, total: deliveryTotal, totalPages: Math.max(1, Math.ceil(deliveryTotal / take)) },
    recent,
  };
}

export async function retryNotificationOutboxEvent(actor: AuthUser, id: string) {
  const rate = await checkRateLimitAsync(`notification-outbox-retry:${actor.id}`, 20, 60);
  if (!rate.allowed) throw AppError.rateLimited(`Retry limit reached. Try again in ${rate.retryAfter}s.`);
  const event = await prisma.notificationOutbox.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!event) throw AppError.notFound("Notification outbox event not found.");
  if (
    event.status !== NotificationOutboxStatus.DEAD_LETTER &&
    event.status !== NotificationOutboxStatus.RETRY_PENDING
  ) throw AppError.conflict("Only failed notification events can be retried.");
  const updated = await prisma.$transaction(async (tx) => {
    const retried = await tx.notificationOutbox.update({ where: { id }, data: { status: NotificationOutboxStatus.PENDING, nextAttemptAt: new Date(), processingLeaseId: null, leaseExpiresAt: null, lastErrorCode: null, lastError: null } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: "NOTIFICATION_OUTBOX_RETRY_REQUESTED", resourceType: "NOTIFICATION_OUTBOX", resourceId: id, description: "Authorized manual notification outbox retry requested.", status: "SUCCESS" } });
    return retried;
  });
  return updated;
}

export const notificationOutboxService = { enqueueSupportNotification, processNotificationOutboxBatch, getNotificationOutboxSummary, retryNotificationOutboxEvent };
