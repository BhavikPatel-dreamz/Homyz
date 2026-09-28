import { prisma } from "@/lib/db/prisma";
import { NotificationType, BookingStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";

export type NotificationDTO = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  entityId: string | null;
  entityType: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationFilter = {
  type?: NotificationType | "ALL";
  unreadOnly?: boolean;
  skip?: number;
  take?: number;
};

function toDTO(n: {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | null;
  entityId: string | null;
  entityType: string | null;
  link: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationDTO {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    entityId: n.entityId,
    entityType: n.entityType,
    link: n.link,
    metadata: (n.metadata as Record<string, unknown>) || null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

// In-flight synchronization mutex to avoid concurrent duplicate creation
const activeSyncs = new Map<string, Promise<void>>();

/**
 * Creates a notification record strictly for a specific user with idempotency protection.
 */
async function create(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string | null;
  entityType?: string | null;
  link?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<NotificationDTO> {
  if (!data.userId) {
    throw AppError.badRequest("Cannot create notification without target userId");
  }

  // Idempotency check: prevent duplicate notifications for the same user and entity/event
  if (data.entityId) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: data.userId,
        type: data.type,
        entityId: data.entityId,
        ...(data.entityType ? { entityType: data.entityType } : {}),
      },
    });

    if (existing) {
      if (existing.title !== data.title || existing.message !== data.message) {
        const updated = await prisma.notification.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            message: data.message,
            link: data.link || existing.link,
            metadata: data.metadata ?? undefined,
          },
        });
        return toDTO(updated);
      }
      return toDTO(existing);
    }
  } else if (data.entityType) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: data.userId,
        type: data.type,
        entityType: data.entityType,
      },
    });

    if (existing) {
      return toDTO(existing);
    }
  }

  const created = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      entityId: data.entityId || null,
      entityType: data.entityType || null,
      link: data.link || null,
      metadata: data.metadata ?? undefined,
    },
  });

  return toDTO(created);
}

/**
 * Ensures existing real bookings and events belonging strictly to the user have notifications.
 * Deduplicates and guarantees no cross-user pollution.
 */
async function syncRealEventsForUser(userId: string): Promise<void> {
  if (!userId) return;

  const existingSync = activeSyncs.get(userId);
  if (existingSync) {
    return existingSync;
  }

  const syncPromise = (async () => {
    try {
      // 1. Check existing bookings owned by this guest
      const userBookings = await prisma.booking.findMany({
        where: { userId }, // strictly for this user
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              city: true,
              country: true,
              hostId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      for (const b of userBookings) {
        const existingNotif = await prisma.notification.findFirst({
          where: {
            userId,
            entityId: b.id,
            type: NotificationType.BOOKING,
          },
          select: { id: true },
        });

        if (!existingNotif) {
          const listingTitle = b.listing?.title || "Property";
          const startStr = b.startDate.toISOString().slice(0, 10);
          const isConfirmed = b.status === BookingStatus.CONFIRMED;
          const isCancelled = b.status === BookingStatus.CANCELLED;

          let title = `Reservation Confirmed: ${listingTitle}`;
          let message = `Your reservation from ${startStr} has been confirmed. View your trip details and arrival instructions.`;
          let link = "/profile/tab/upcoming";

          if (isCancelled) {
            title = `Reservation Cancelled: ${listingTitle}`;
            message = `Your reservation for ${listingTitle} has been cancelled.`;
            link = "/profile/tab/past";
          } else if (!isConfirmed) {
            title = `Booking Request: ${listingTitle}`;
            message = `Your booking request for ${listingTitle} is being reviewed.`;
            link = "/profile/tab/upcoming";
          }

          await prisma.notification.create({
            data: {
              userId,
              type: NotificationType.BOOKING,
              title,
              message,
              entityId: b.id,
              entityType: "booking",
              link,
              createdAt: b.createdAt,
              metadata: {
                bookingId: b.id,
                listingId: b.listingId,
                status: b.status,
              },
            },
          });
        }
      }

      // 1b. Check existing reservations on listings owned by this host
      const hostListings = await prisma.listing.findMany({
        where: { hostId: userId },
        select: { id: true },
      });

      if (hostListings.length > 0) {
        const hostListingIds = hostListings.map((l: { id: string }) => l.id);
        const hostBookings = await prisma.booking.findMany({
          where: {
            listingId: { in: hostListingIds },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
              },
            },
            listing: {
              select: {
                id: true,
                title: true,
                city: true,
                country: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 15,
        });

        for (const hb of hostBookings) {
          if (hb.userId === userId) continue;

          const existingHostNotif = await prisma.notification.findFirst({
            where: {
              userId,
              entityId: hb.id,
              entityType: "host_booking",
              type: NotificationType.BOOKING,
            },
            select: { id: true },
          });

          if (!existingHostNotif) {
            const listingTitle = hb.listing?.title || "Property";
            const guestName = hb.user?.name || hb.user?.firstName || "A guest";
            const startStr = hb.startDate.toISOString().slice(0, 10);
            const endStr = hb.endDate.toISOString().slice(0, 10);
            const isConfirmed = hb.status === BookingStatus.CONFIRMED;
            const isCancelled = hb.status === BookingStatus.CANCELLED;

            let title = `New Reservation: ${listingTitle}`;
            let message = `${guestName} booked ${listingTitle} from ${startStr} to ${endStr}.`;
            let link = "/host/bookings";

            if (isCancelled) {
              title = `Reservation Cancelled: ${listingTitle}`;
              message = `${guestName} cancelled their reservation for ${listingTitle}.`;
            } else if (!isConfirmed) {
              title = `Booking Request: ${listingTitle}`;
              message = `${guestName} requested to book ${listingTitle} from ${startStr} to ${endStr}.`;
            }

            await prisma.notification.create({
              data: {
                userId,
                type: NotificationType.BOOKING,
                title,
                message,
                entityId: hb.id,
                entityType: "host_booking",
                link,
                createdAt: hb.createdAt,
                metadata: {
                  bookingId: hb.id,
                  listingId: hb.listingId,
                  guestId: hb.userId,
                  guestName,
                  status: hb.status,
                  role: "host",
                },
              },
            });
          }
        }
      }

      // 2. Check profile completion alert for this user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          birthDate: true,
          phone: true,
          referralCode: true,
          role: true,
        },
      });

      if (user && (!user.birthDate || !user.phone)) {
        const existingSystemNotif = await prisma.notification.findFirst({
          where: {
            userId,
            type: NotificationType.SYSTEM,
            entityType: "profile_completion",
          },
          select: { id: true },
        });

        if (!existingSystemNotif) {
          await prisma.notification.create({
            data: {
              userId,
              type: NotificationType.SYSTEM,
              title: "Complete your profile information",
              message: "Please add your birth date and contact number to complete your account setup and unlock full guest access.",
              link: "/profile/tab/profile_management/profile_information",
              entityType: "profile_completion",
            },
          });
        }
      }

      // 3. User's own referral code promo (never another user's code)
      if (user?.referralCode) {
        const existingPromo = await prisma.notification.findFirst({
          where: {
            userId,
            type: NotificationType.PROMOTION,
            entityType: "referral_program",
          },
          select: { id: true },
        });

        if (!existingPromo) {
          await prisma.notification.create({
            data: {
              userId,
              type: NotificationType.PROMOTION,
              title: "Invite Friends & Earn Rewards",
              message: `Share your referral code ${user.referralCode} with friends to earn points toward your next getaway!`,
              link: "/profile/tab/invite",
              entityType: "referral_program",
            },
          });
        }
      }
    } finally {
      activeSyncs.delete(userId);
    }
  })();

  activeSyncs.set(userId, syncPromise);
  return syncPromise;
}

/**
 * Fetches notifications strictly for the given user, sorted newest-first.
 * Guaranteed never to return notifications belonging to another user.
 */
async function listForUser(
  userId: string,
  filter?: NotificationFilter,
): Promise<{ items: NotificationDTO[]; total: number; unreadCount: number }> {
  if (!userId) {
    throw AppError.unauthorized("Authentication required to list notifications");
  }

  // Sync real events once per user session
  try {
    await syncRealEventsForUser(userId);
  } catch (err) {
    console.warn("[notification.service] syncRealEvents error:", err);
  }

  // STRICT query clause: only notifications where userId equals the authenticated user's ID
  const whereClause: Prisma.NotificationWhereInput = {
    userId,
  };

  if (filter?.type && filter.type !== "ALL") {
    whereClause.type = filter.type;
  }

  if (filter?.unreadOnly) {
    whereClause.isRead = false;
  }

  const [rawItems, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: filter?.skip ?? 0,
      take: filter?.take ?? 50,
    }),
    prisma.notification.count({ where: whereClause }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  // In-memory deduplication safeguard
  const seenKeys = new Set<string>();
  const items: NotificationDTO[] = [];

  for (const raw of rawItems) {
    const key = raw.entityId
      ? `${raw.type}:${raw.entityId}`
      : `${raw.type}:${raw.entityType || raw.title}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      items.push(toDTO(raw));
    }
  }

  return {
    items,
    total: items.length < rawItems.length ? items.length : total,
    unreadCount,
  };
}

/**
 * Gets count of unread notifications strictly for a user.
 */
async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

/**
 * Marks a specific notification as read.
 * Enforces ownership: only the notification owner can mark it.
 */
async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<NotificationDTO> {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw AppError.notFound("Notification not found");
  }

  if (existing.userId !== userId) {
    throw AppError.forbidden("You cannot modify another user's notification");
  }

  if (existing.isRead) {
    return toDTO(existing);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return toDTO(updated);
}

/**
 * Toggles or marks a notification as unread.
 * Enforces ownership: only the notification owner can mark it.
 */
async function markAsUnread(
  userId: string,
  notificationId: string,
): Promise<NotificationDTO> {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw AppError.notFound("Notification not found");
  }

  if (existing.userId !== userId) {
    throw AppError.forbidden("You cannot modify another user's notification");
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: false,
      readAt: null,
    },
  });

  return toDTO(updated);
}

/**
 * Marks all notifications as read for a user.
 * Strictly scoped to the authenticated user.
 */
async function markAllAsRead(userId: string): Promise<{ count: number }> {
  if (!userId) {
    throw AppError.unauthorized("Authentication required");
  }

  const res = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { count: res.count };
}

/**
 * Deletes a notification (enforcing ownership).
 */
async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw AppError.notFound("Notification not found");
  }

  if (existing.userId !== userId) {
    throw AppError.forbidden("You cannot delete another user's notification");
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });
}

/**
 * Helper to dispatch a targeted message notification to a specific participant.
 */
async function sendHostMessageNotification(params: {
  recipientUserId: string;
  senderName: string;
  messagePreview: string;
  conversationId: string;
}): Promise<NotificationDTO> {
  return create({
    userId: params.recipientUserId,
    type: NotificationType.MESSAGE,
    title: `Message from ${params.senderName}`,
    message: params.messagePreview,
    entityId: params.conversationId,
    entityType: "conversation",
    link: "/host/messages",
    metadata: {
      conversationId: params.conversationId,
      senderName: params.senderName,
    },
  });
}

export const notificationService = {
  create,
  listForUser,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  syncRealEventsForUser,
  sendHostMessageNotification,
};
