import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { PaymentStatus, PaymentProvider, BookingStatus, NotificationType, RefundStatus } from "@/generated/prisma/enums";
import { auditService } from "@/services/audit.service";
import { notificationService } from "@/services/notification.service";
import { moyasarAdapter } from "@/lib/payment/moyasar-adapter";
import type { WebhookEventPayload } from "@/lib/payment/provider-interface";
import { nanoid } from "nanoid";

export interface WebhookProcessResult {
  success: boolean;
  duplicate: boolean;
  eventId: string;
  paymentId?: string;
  bookingId?: string;
  status?: PaymentStatus;
  message: string;
}

/**
 * Authoritative Payment Webhook Processor.
 * Guarantees signature authenticity, strict idempotency, atomic database transitions,
 * and comprehensive financial audit logging.
 */
export async function processPaymentWebhook(
  rawBody: string,
  signature: string,
  secretOverride?: string,
): Promise<WebhookProcessResult> {
  // 1. Signature Verification
  const isValid = moyasarAdapter.verifyWebhookSignature(rawBody, signature, secretOverride);
  if (!isValid) {
    throw AppError.unauthorized("Invalid webhook signature or secret unconfigured.");
  }

  // 2. Event Structure Validation
  const event: WebhookEventPayload | null = moyasarAdapter.parseWebhookEvent(rawBody);
  if (!event || !event.id || !event.data?.id) {
    throw AppError.badRequest("Malformed webhook event payload.");
  }

  const eventId = event.id;
  const paymentProviderId = event.data.id;
  const eventType = event.type.toLowerCase();
  const paymentAmount = event.data.amount;
  const paymentCurrency = event.data.currency;

  // 3. Duplicate Event Detection via Audit Log
  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      resourceType: "WEBHOOK_EVENT",
      resourceId: eventId,
      action: "PAYMENT_WEBHOOK_PROCESSED",
    },
    select: { id: true, createdAt: true },
  });

  if (existingAudit) {
    return {
      success: true,
      duplicate: true,
      eventId,
      message: "Webhook event was already processed.",
    };
  }

  // 4. Find Associated Payment Record
  const bookingIdFromMeta = typeof event.data.metadata?.bookingId === "string" ? event.data.metadata.bookingId : null;

  const payment = await prisma.bookingPayment.findFirst({
    where: {
      OR: [
        { providerPaymentId: paymentProviderId },
        ...(bookingIdFromMeta ? [{ bookingId: bookingIdFromMeta }] : []),
      ],
    },
    include: {
      booking: {
        select: {
          id: true,
          status: true,
          userId: true,
          listingId: true,
          listing: { select: { title: true, hostId: true } },
        },
      },
    },
  });

  if (!payment) {
    // Audit unrecognized payment reference
    await auditService.record({
      action: "PAYMENT_WEBHOOK_UNKNOWN_TRANSACTION",
      resourceType: "WEBHOOK_EVENT",
      resourceId: eventId,
      description: `Received webhook for unknown payment provider ID ${paymentProviderId}.`,
      status: "FAILURE",
      metadata: {
        providerPaymentId: paymentProviderId,
        eventType,
        amount: paymentAmount,
        currency: paymentCurrency,
      },
    });

    throw AppError.notFound(`Payment record for provider payment ID ${paymentProviderId} not found.`);
  }

  // 5. Apply Atomic Financial Transition
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Acquire advisory lock on payment record to prevent race conditions from concurrent webhook deliveries
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id}))`;

    const freshPayment = await tx.bookingPayment.findUnique({
      where: { id: payment.id },
      include: { booking: true },
    });

    if (!freshPayment) {
      throw AppError.notFound("Payment not found during atomic update.");
    }

    // Terminal state protection: terminal states cannot be regressed by delayed/out-of-order events
    if (freshPayment.status === PaymentStatus.REFUNDED || freshPayment.status === PaymentStatus.VOIDED) {
      return {
        payment: freshPayment,
        booking: freshPayment.booking,
        status: freshPayment.status,
        updated: false,
      };
    }

    let targetPaymentStatus: PaymentStatus = freshPayment.status;
    let nextCapturedAmount = freshPayment.capturedAmount;
    let nextRefundedAmount = freshPayment.refundedAmount;
    let shouldConfirmBooking = false;
    const now = new Date();

    if (eventType === "payment.paid" || eventType === "payment.captured") {
      // Idempotency: if already CAPTURED with same provider reference, return early
      if (freshPayment.status === PaymentStatus.CAPTURED && freshPayment.providerPaymentId === paymentProviderId) {
        return {
          payment: freshPayment,
          booking: freshPayment.booking,
          status: freshPayment.status,
          updated: false,
        };
      }

      targetPaymentStatus = PaymentStatus.CAPTURED;
      nextCapturedAmount = paymentAmount > 0 ? paymentAmount : freshPayment.amount;

      if (freshPayment.booking.status === BookingStatus.PENDING) {
        shouldConfirmBooking = true;
      }
    } else if (eventType === "payment.authorized" || (eventType === "payment.updated" && event.data.status === "authorized")) {
      if (freshPayment.status === PaymentStatus.PENDING) {
        targetPaymentStatus = PaymentStatus.AUTHORIZED;
      }
    } else if (eventType === "payment.voided" || eventType === "payment.canceled") {
      if (freshPayment.status === PaymentStatus.AUTHORIZED || freshPayment.status === PaymentStatus.PENDING) {
        targetPaymentStatus = PaymentStatus.VOIDED;
      }
    } else if (eventType === "payment.failed") {
      // Guard against out-of-order failed event overriding already CAPTURED payment
      if (freshPayment.status !== PaymentStatus.CAPTURED) {
        targetPaymentStatus = PaymentStatus.FAILED;
      }
    } else if (eventType === "payment.refunded") {
      nextRefundedAmount = typeof event.data.refunded === "number" ? event.data.refunded : freshPayment.amount;
      targetPaymentStatus =
        nextRefundedAmount >= freshPayment.capturedAmount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

      // Synchronize associated BookingRefund record
      const existingRefund = await tx.bookingRefund.findFirst({
        where: {
          paymentId: freshPayment.id,
          status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingRefund) {
        await tx.bookingRefund.update({
          where: { id: existingRefund.id },
          data: {
            status: RefundStatus.SUCCEEDED,
            succeededAt: now,
            providerRefundId: String(event.data.id || paymentProviderId),
            metadata: {
              ...((existingRefund.metadata as Record<string, unknown>) || {}),
              webhookSynchronizedAt: now.toISOString(),
              webhookEventId: eventId,
            },
          },
        });
      } else {
        const refundDifference = nextRefundedAmount - freshPayment.refundedAmount;
        if (refundDifference > 0) {
          await tx.bookingRefund.create({
            data: {
              bookingId: freshPayment.bookingId,
              paymentId: freshPayment.id,
              refundReference: `REF-${nanoid(8).toUpperCase()}`,
              idempotencyKey: `idem_wh_refund_${eventId}`,
              status: RefundStatus.SUCCEEDED,
              currency: freshPayment.currency || "SAR",
              amount: refundDifference,
              reason: "Provider webhook refund synchronization",
              approvedById: "GATEWAY_WEBHOOK",
              processedAt: now,
              succeededAt: now,
              providerRefundId: String(event.data.id || paymentProviderId),
              metadata: {
                refundType: nextRefundedAmount >= freshPayment.capturedAmount ? "FULL" : "PARTIAL",
                webhookEventId: eventId,
              },
            },
          });
        }
      }
    }

    // Persist Payment update
    const updatedPayment = await tx.bookingPayment.update({
      where: { id: freshPayment.id },
      data: {
        status: targetPaymentStatus,
        provider: PaymentProvider.MOYASAR,
        providerPaymentId: paymentProviderId,
        capturedAmount: nextCapturedAmount,
        refundedAmount: nextRefundedAmount,
        capturedAt: targetPaymentStatus === PaymentStatus.CAPTURED ? now : freshPayment.capturedAt,
        failedAt: targetPaymentStatus === PaymentStatus.FAILED ? now : freshPayment.failedAt,
        failureReason: targetPaymentStatus === PaymentStatus.FAILED ? event.data.source?.message || "Payment failed" : freshPayment.failureReason,
        metadata: {
          ...((freshPayment.metadata as Record<string, unknown>) || {}),
          lastWebhookEventId: eventId,
          lastWebhookEventType: eventType,
          lastWebhookProcessedAt: now.toISOString(),
        },
      },
    });

    let updatedBooking = freshPayment.booking;
    if (shouldConfirmBooking) {
      updatedBooking = await tx.booking.update({
        where: { id: freshPayment.bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
        },
      });
    }

    // Atomically persist the processed webhook event in AuditLog to enforce duplicate protection
    await tx.auditLog.create({
      data: {
        action: "PAYMENT_WEBHOOK_PROCESSED",
        resourceType: "WEBHOOK_EVENT",
        resourceId: eventId,
        description: `Successfully processed provider event ${eventType} for payment ${freshPayment.id}.`,
        status: "SUCCESS",
        metadata: {
          paymentId: freshPayment.id,
          bookingId: freshPayment.bookingId,
          providerPaymentId: paymentProviderId,
          eventType,
          priorStatus: freshPayment.status,
          targetStatus: targetPaymentStatus,
          amount: paymentAmount,
          currency: paymentCurrency,
        },
      },
    });

    return {
      payment: updatedPayment,
      booking: updatedBooking,
      status: targetPaymentStatus,
      updated: true,
    };
  });

  // 6. Post-transaction notifications
  if (result.updated && result.status === PaymentStatus.CAPTURED && payment.booking) {
    try {
      await notificationService.create({
        userId: payment.booking.userId,
        type: NotificationType.BOOKING,
        title: "Payment Received",
        message: `Your payment of SAR ${(paymentAmount / 100).toFixed(2)} for ${payment.booking.listing.title} has been received.`,
        entityId: payment.booking.id,
        entityType: "booking",
        link: "/profile/tab/upcoming",
        metadata: {
          bookingId: payment.booking.id,
          paymentId: payment.id,
          status: "CAPTURED",
        },
      });

      if (payment.booking.listing?.hostId) {
        await notificationService.create({
          userId: payment.booking.listing.hostId,
          type: NotificationType.BOOKING,
          title: "Payment Confirmed",
          message: `Payment of SAR ${(paymentAmount / 100).toFixed(2)} confirmed for reservation at ${payment.booking.listing.title}.`,
          entityId: payment.booking.id,
          entityType: "host_booking",
          link: `/host/bookings/${payment.booking.id}`,
          metadata: {
            bookingId: payment.booking.id,
            paymentId: payment.id,
            status: "CAPTURED",
            role: "host",
          },
        });
      }
    } catch (err) {
      console.warn("[payment-webhook] Failed to dispatch payment notification:", err);
    }
  }

  if (result.updated && (result.status === PaymentStatus.REFUNDED || result.status === PaymentStatus.PARTIALLY_REFUNDED) && payment.booking) {
    try {
      await notificationService.create({
        userId: payment.booking.userId,
        type: NotificationType.BOOKING,
        title: "Refund Processed",
        message: `Your refund for ${payment.booking.listing.title} has been confirmed by the payment provider.`,
        entityId: payment.booking.id,
        entityType: "booking",
        link: "/profile/tab/past",
        metadata: {
          bookingId: payment.booking.id,
          paymentId: payment.id,
          status: result.status,
        },
      });
    } catch (err) {
      console.warn("[payment-webhook] Failed to dispatch refund notification:", err);
    }
  }

  return {
    success: true,
    duplicate: false,
    eventId,
    paymentId: payment.id,
    bookingId: payment.bookingId,
    status: result.status,
    message: "Webhook processed successfully.",
  };
}

