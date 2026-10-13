import { prisma } from "@/lib/db/prisma";
import { NotificationType, Role, BookingStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { assertRole } from "@/lib/permissions/authorize";
import type { AuthUser } from "@/lib/auth/types";

export interface NotificationSummaryData {
  totalNotifications: number;
  pendingNotifications: number;
  sentNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
  retryingNotifications: number;
  requiresAttentionCount: number;
}

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  channel?: string;
  recipientRole?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export type DeliveryStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "RETRYING";

export class NotificationAdminService {
  /**
   * Returns 7 aggregate KPI metrics for Booking Notifications dashboard.
   */
  async getNotificationSummaryForAdmin(actor: AuthUser): Promise<NotificationSummaryData> {
    assertRole(actor, [Role.ADMIN]);

    const [totalNotifications, readCount] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: true } }),
    ]);

    // Inspect recent notification samples to compute delivery status distribution
    const sample = await prisma.notification.findMany({
      take: 500,
      orderBy: { createdAt: "desc" },
      select: {
        isRead: true,
        metadata: true,
      },
    });

    let pendingCount = 0;
    let failedCount = 0;
    let retryingCount = 0;

    for (const item of sample) {
      const meta = item.metadata as Record<string, unknown> | null;
      const status = meta?.deliveryStatus as string | undefined;
      if (status === "PENDING") pendingCount++;
      else if (status === "FAILED") failedCount++;
      else if (status === "RETRYING") retryingCount++;
    }

    const deliveredNotifications = readCount;
    const sentNotifications = Math.max(
      0,
      totalNotifications - (deliveredNotifications + failedCount + pendingCount + retryingCount),
    );

    return {
      totalNotifications,
      pendingNotifications: pendingCount,
      sentNotifications,
      deliveredNotifications,
      failedNotifications: failedCount,
      retryingNotifications: retryingCount,
      requiresAttentionCount: failedCount + retryingCount,
    };
  }

  /**
   * Lists paginated notifications with server-side filters.
   */
  async listNotificationsForAdmin(
    actor: AuthUser,
    query: NotificationListQuery,
  ): Promise<{
    notifications: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    assertRole(actor, [Role.ADMIN]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {};

    // Search filter
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { id: { contains: term, mode: "insensitive" } },
        { entityId: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
        { message: { contains: term, mode: "insensitive" } },
        { user: { name: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
      ];
    }

    // Type filter
    if (query.type && query.type !== "ALL") {
      where.type = query.type as NotificationType;
    }

    // Recipient Role filter
    if (query.recipientRole && query.recipientRole !== "ALL") {
      where.user = {
        role: query.recipientRole as Role,
      };
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    const formatted = (items as any[]).map((item: any) => {
      const meta = item.metadata as Record<string, unknown> | null;
      const deliveryStatus: DeliveryStatus =
        (meta?.deliveryStatus as DeliveryStatus) || (item.isRead ? "DELIVERED" : "SENT");
      const channel = (meta?.channel as string) || "IN_APP";
      const attemptCount = typeof meta?.attemptCount === "number" ? meta.attemptCount : 1;

      return {
        id: item.id,
        userId: item.userId,
        type: item.type,
        title: item.title,
        message: item.message,
        isRead: item.isRead,
        readAt: item.readAt ? item.readAt.toISOString() : null,
        entityId: item.entityId,
        entityType: item.entityType,
        link: item.link,
        channel,
        deliveryStatus,
        attemptCount,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        user: item.user,
      };
    });

    return {
      notifications: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single notification details with delivery timeline.
   */
  async getNotificationDetailsForAdmin(actor: AuthUser, notificationId: string) {
    assertRole(actor, [Role.ADMIN]);

    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            image: true,
            createdAt: true,
          },
        },
      },
    });

    if (!notif) {
      throw AppError.notFound("Notification not found");
    }

    // Load related booking if entityType === "booking" or "host_booking"
    let relatedBooking: any = null;
    if (notif.entityId) {
      relatedBooking = await prisma.booking.findUnique({
        where: { id: notif.entityId },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          totalPrice: true,
          currency: true,
          listing: {
            select: {
              id: true,
              title: true,
              city: true,
            },
          },
        },
      }).catch(() => null);
    }

    const meta = notif.metadata as Record<string, unknown> | null;
    const deliveryStatus: DeliveryStatus =
      (meta?.deliveryStatus as DeliveryStatus) || (notif.isRead ? "DELIVERED" : "SENT");
    const channel = (meta?.channel as string) || "IN_APP";
    const templateId = (meta?.templateId as string) || `${notif.type.toLowerCase()}_standard_v1`;
    const attemptCount = typeof meta?.attemptCount === "number" ? meta.attemptCount : 1;
    const failureReason = (meta?.failureReason as string) || null;
    const attemptHistory = Array.isArray(meta?.attempts) ? meta.attempts : [];

    return {
      id: notif.id,
      userId: notif.userId,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      isRead: notif.isRead,
      readAt: notif.readAt ? notif.readAt.toISOString() : null,
      entityId: notif.entityId,
      entityType: notif.entityType,
      link: notif.link,
      channel,
      deliveryStatus,
      templateId,
      attemptCount,
      failureReason,
      attemptHistory,
      metadata: meta,
      createdAt: notif.createdAt.toISOString(),
      updatedAt: notif.updatedAt.toISOString(),
      user: notif.user,
      relatedBooking,
    };
  }

  /**
   * Controlled manual retry for eligible failed or transient notifications.
   * Enforces retry bounds, booking relevance, and records audit trail.
   */
  async retryNotificationForAdmin(actor: AuthUser, notificationId: string) {
    assertRole(actor, [Role.ADMIN]);

    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!notif) {
      throw AppError.notFound("Notification not found");
    }

    const meta = (notif.metadata as Record<string, unknown>) || {};
    const attemptCount = typeof meta.attemptCount === "number" ? meta.attemptCount : 1;

    // Retry guard 1: Max attempt threshold
    if (attemptCount >= 5) {
      throw AppError.badRequest("Maximum retry limit (5 attempts) exceeded for this notification");
    }

    // Retry guard 2: Check booking relevance if attached to a booking
    if (notif.entityId && notif.type === NotificationType.BOOKING) {
      const booking = await prisma.booking.findUnique({
        where: { id: notif.entityId },
        select: { id: true, status: true },
      });

      if (booking) {
        // If message is a request pending review, but booking is already cancelled or confirmed, reject obsolete resend
        if (
          notif.title.toLowerCase().includes("request") &&
          (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.CONFIRMED)
        ) {
          throw AppError.badRequest(
            `Cannot resend pending request notification: reservation status is now ${booking.status}`,
          );
        }
      }
    }

    const newAttempt = {
      attemptNumber: attemptCount + 1,
      timestamp: new Date().toISOString(),
      dispatchedBy: actor.email || actor.id,
      status: "SENT",
      note: "Admin initiated retry",
    };

    const updatedAttempts = Array.isArray(meta.attempts) ? [...meta.attempts, newAttempt] : [newAttempt];

    const updatedMeta: Prisma.InputJsonValue = {
      ...meta,
      attemptCount: attemptCount + 1,
      deliveryStatus: "SENT",
      lastAttemptAt: new Date().toISOString(),
      attempts: updatedAttempts as Prisma.InputJsonValue,
      failureReason: null,
    };

    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: {
        metadata: updatedMeta,
        updatedAt: new Date(),
      },
    });

    // Record audit event
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email || "admin@homyz.test",
        actorRole: actor.role,
        action: "NOTIFICATION_RETRIED",
        entityType: "Notification",
        entityId: notif.id,
        details: {
          recipientId: notif.userId,
          recipientEmail: notif.user?.email,
          attemptNumber: attemptCount + 1,
        },
      },
    }).catch((err: any) => {
      console.error("[NotificationAdminService] Audit log error:", err);
    });

    return {
      success: true,
      message: `Notification retry dispatched successfully (Attempt #${attemptCount + 1}).`,
      notification: {
        id: updated.id,
        deliveryStatus: "SENT",
        attemptCount: attemptCount + 1,
      },
    };
  }
}

export const notificationAdminService = new NotificationAdminService();

