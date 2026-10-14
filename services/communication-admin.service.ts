import { prisma } from "@/lib/db/prisma";
import { ConversationType, ConversationStatus, Role, QualityIncidentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { assertRole } from "@/lib/permissions/authorize";
import type { AuthUser } from "@/lib/auth/types";

export interface CommunicationSummaryData {
  totalConversations: number;
  activeConversations: number;
  bookingInquiries: number;
  bookingRequests: number;
  confirmedConversations: number;
  reportedConversations: number;
}

export interface ConversationListQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  listingId?: string;
  hostId?: string;
  guestId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "lastMessageAt" | "createdAt";
  sortOrder?: "asc" | "desc";
}

/**
 * Sanitizes message previews to protect sensitive credentials (e.g. Wi-Fi passwords, access codes).
 */
export function sanitizeMessagePreview(content: string): string {
  if (!content) return "";
  // Redact potential access codes / PIN patterns, lock codes, keys, passwords
  let sanitized = content.replace(/(?:pin|lock\s*code|door\s*code|access\s*code|passcode|key|pass(?:word)?|code)\s*[:=-]?\s*([0-9a-zA-Z]{4,32})/gi, (match, code) => {
    return match.replace(code, "[PROTECTED]");
  });
  // Truncate preview
  if (sanitized.length > 160) {
    sanitized = sanitized.slice(0, 157) + "...";
  }
  return sanitized;
}

export class CommunicationAdminService {
  /**
   * Returns summary KPI metrics for Admin Booking Communications.
   */
  async getCommunicationSummaryForAdmin(actor: AuthUser): Promise<CommunicationSummaryData> {
    assertRole(actor, [Role.ADMIN]);

    const [
      totalConversations,
      activeConversations,
      bookingInquiries,
      bookingRequests,
      confirmedConversations,
      reportedIncidentsCount,
    ] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.count({ where: { status: ConversationStatus.ACTIVE } }),
      prisma.conversation.count({ where: { type: ConversationType.INQUIRY } }),
      prisma.conversation.count({ where: { type: ConversationType.BOOKING_REQUEST } }),
      prisma.conversation.count({ where: { status: ConversationStatus.CONFIRMED } }),
      prisma.listingQualityIncident.count({
        where: {
          status: { in: [QualityIncidentStatus.PENDING, QualityIncidentStatus.CONFIRMED] },
        },
      }),
    ]);

    return {
      totalConversations,
      activeConversations,
      bookingInquiries,
      bookingRequests,
      confirmedConversations,
      reportedConversations: reportedIncidentsCount,
    };
  }

  /**
   * Lists paginated booking conversations with server-side filters.
   */
  async listBookingConversationsForAdmin(
    actor: AuthUser,
    query: ConversationListQuery,
  ): Promise<{
    conversations: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    assertRole(actor, [Role.ADMIN]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {};

    // Search filter
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { id: { contains: term, mode: "insensitive" } },
        { bookingId: { contains: term, mode: "insensitive" } },
        { listing: { title: { contains: term, mode: "insensitive" } } },
        { guest: { name: { contains: term, mode: "insensitive" } } },
        { guest: { email: { contains: term, mode: "insensitive" } } },
        { host: { name: { contains: term, mode: "insensitive" } } },
        { host: { email: { contains: term, mode: "insensitive" } } },
      ];
    }

    // Type filter
    if (query.type && query.type !== "ALL") {
      where.type = query.type as ConversationType;
    }

    // Status filter
    if (query.status && query.status !== "ALL") {
      where.status = query.status as ConversationStatus;
    }

    // Association filters
    if (query.listingId) where.listingId = query.listingId;
    if (query.hostId) where.hostId = query.hostId;
    if (query.guestId) where.guestId = query.guestId;

    // Date range filter
    if (query.startDate || query.endDate) {
      where.lastMessageAt = {};
      if (query.startDate) where.lastMessageAt.gte = new Date(query.startDate);
      if (query.endDate) where.lastMessageAt.lte = new Date(query.endDate);
    }

    const sortBy = query.sortBy || "lastMessageAt";
    const sortOrder = query.sortOrder || "desc";

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          guest: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              city: true,
              country: true,
              photos: true,
            },
          },
          booking: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              totalPrice: true,
              currency: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              content: true,
              type: true,
              createdAt: true,
              senderId: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    const formatted = (conversations as any[]).map((conv: any) => {
      const lastMsg = conv.messages[0] || null;
      return {
        id: conv.id,
        bookingId: conv.bookingId,
        type: conv.type,
        status: conv.status,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        createdAt: conv.createdAt.toISOString(),
        totalMessages: conv._count.messages,
        guest: conv.guest,
        host: conv.host,
        listing: conv.listing,
        booking: conv.booking
          ? {
              ...conv.booking,
              startDate: conv.booking.startDate.toISOString(),
              endDate: conv.booking.endDate.toISOString(),
            }
          : null,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              contentPreview: sanitizeMessagePreview(lastMsg.content),
              type: lastMsg.type,
              createdAt: lastMsg.createdAt.toISOString(),
              isFromGuest: lastMsg.senderId === conv.guestId,
              isFromHost: lastMsg.senderId === conv.hostId,
            }
          : null,
      };
    });

    return {
      conversations: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves read-only conversation details with message history.
   * IMPORTANT (Task 13.5): Admin inspection NEVER marks messages as read for guest or host.
   */
  async getConversationDetailsForAdmin(
    actor: AuthUser,
    conversationId: string,
    options?: { messageLimit?: number; messageBefore?: string },
  ) {
    assertRole(actor, [Role.ADMIN]);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            createdAt: true,
          },
        },
        host: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            country: true,
            photos: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
            currency: true,
            guests: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw AppError.notFound("Conversation not found");
    }

    const messageLimit = Math.min(100, Math.max(1, options?.messageLimit || 50));
    const messageWhere: Prisma.MessageWhereInput = {
      conversationId,
    };

    if (options?.messageBefore) {
      messageWhere.createdAt = {
        lt: new Date(options.messageBefore),
      };
    }

    const messages = await prisma.message.findMany({
      where: messageWhere,
      take: messageLimit,
      orderBy: { createdAt: "desc" },
      include: {
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            mimeType: true,
            fileSize: true,
            fileUrl: true,
            createdAt: true,
          },
        },
      },
    });

    // Chronological order for viewing
    const reversedMessages = (messages as any[]).reverse().map((m: any) => ({
      id: m.id,
      content: sanitizeMessagePreview(m.content),
      type: m.type,
      senderId: m.senderId,
      readAt: m.readAt ? m.readAt.toISOString() : null,
      metadata: m.metadata as Record<string, unknown> | null,
      createdAt: m.createdAt.toISOString(),
      attachments: (m.attachments || []).map((a: any) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      senderRole:
        m.senderId === conversation.guestId
          ? "GUEST"
          : m.senderId === conversation.hostId
            ? "HOST"
            : "SYSTEM",
    }));

    // Record audit event for administrative conversation inspection
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email || "admin@homyz.test",
        actorRole: actor.role,
        action: "CONVERSATION_INSPECTED",
        entityType: "Conversation",
        entityId: conversation.id,
        details: {
          bookingId: conversation.bookingId,
          guestId: conversation.guestId,
          hostId: conversation.hostId,
        },
      },
    }).catch((err: any) => {
      console.error("[CommunicationAdminService] Audit log error:", err);
    });

    return {
      conversation: {
        id: conversation.id,
        bookingId: conversation.bookingId,
        type: conversation.type,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt.toISOString(),
        createdAt: conversation.createdAt.toISOString(),
        guest: {
          ...conversation.guest,
          createdAt: conversation.guest.createdAt.toISOString(),
        },
        host: {
          ...conversation.host,
          createdAt: conversation.host.createdAt.toISOString(),
        },
        listing: conversation.listing,
        booking: conversation.booking
          ? {
              ...conversation.booking,
              startDate: conversation.booking.startDate.toISOString(),
              endDate: conversation.booking.endDate.toISOString(),
              createdAt: conversation.booking.createdAt.toISOString(),
            }
          : null,
      },
      messages: reversedMessages,
      totalLoaded: reversedMessages.length,
    };
  }
}

export const communicationAdminService = new CommunicationAdminService();

