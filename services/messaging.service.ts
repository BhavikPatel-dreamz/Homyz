import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import {
  ConversationType,
  ConversationStatus,
  MessageType,
  SpecialOfferStatus,
  BookingStatus,
  ListingStatus,
  Role,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { notificationService } from "./notification.service";
import { savePrivateMedia, readPrivateMedia, deletePrivateMedia } from "@/lib/storage/media";
import { HOST_MESSAGE_MAX_LENGTH } from "@/lib/booking/host-message";
import { bookingDateKey, parseBookingDate } from "@/lib/booking/booking-date";

export type MessageAttachmentDTO = {
  id: string;
  conversationId: string;
  messageId: string | null;
  fileName: string;
  fileType: "IMAGE" | "DOCUMENT";
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
};

export type MessageDTO = {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: MessageType;
  content: string;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  sender?: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  } | null;
  isOwn: boolean;
  attachments?: MessageAttachmentDTO[];
};

export type SpecialOfferDTO = {
  id: string;
  conversationId: string;
  hostId: string;
  guestId: string;
  listingId: string;
  startDate: string;
  endDate: string;
  guests: number;
  subtotalPrice: number;
  currency: string;
  status: SpecialOfferStatus;
  expiresAt: string | null;
  createdAt: string;
};

export type ConversationDTO = {
  id: string;
  guestId: string;
  hostId: string;
  listingId: string;
  bookingId: string | null;
  type: ConversationType;
  status: ConversationStatus;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  guest: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
    createdAt: string;
    phone?: string | null;
    isSuperhost?: boolean;
    identityVerified?: boolean;
    emailVerified?: boolean;
  };
  host: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
    createdAt: string;
    isSuperhost?: boolean;
  };
  listing: {
    id: string;
    title: string;
    photos: string[];
    city: string | null;
    district?: string | null;
    country: string | null;
    price: number;
    propertyType: string | null;
    roomType?: string | null;
    checkInStart?: string | null;
    checkOutTime?: string | null;
    cancellationPolicy?: string | null;
  };
  booking?: {
    id: string;
    status: BookingStatus;
    startDate: string;
    endDate: string;
    guests: number;
    totalPrice: number | null;
    nightlyPrice: number | null;
    currency: string;
    cancellationPolicy: string | null;
    isNonRefundable?: boolean;
    priceBreakdown?: any;
    createdAt?: string;
  } | null;
  lastMessage?: MessageDTO | null;
  activeSpecialOffer?: SpecialOfferDTO | null;
  specialOffers?: SpecialOfferDTO[];
};

function toMessageDTO(m: any, currentUserId: string): MessageDTO {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    type: m.type,
    content: m.content,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    metadata: (m.metadata as Record<string, unknown>) || null,
    createdAt: m.createdAt.toISOString(),
    sender: m.sender
      ? {
          id: m.sender.id,
          name: m.sender.name,
          image: m.sender.image,
          role: m.sender.role,
        }
      : null,
    isOwn: m.senderId === currentUserId,
    attachments: Array.isArray(m.attachments)
      ? m.attachments.map((a: any) => ({
          id: a.id,
          conversationId: a.conversationId,
          messageId: a.messageId || null,
          fileName: a.fileName,
          fileType: a.fileType as "IMAGE" | "DOCUMENT",
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          fileUrl: a.fileUrl || `/api/v1/messages/attachments/${a.id}`,
          createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
        }))
      : [],
  };
}

function toSpecialOfferDTO(o: any): SpecialOfferDTO {
  return {
    id: o.id,
    conversationId: o.conversationId,
    hostId: o.hostId,
    guestId: o.guestId,
    listingId: o.listingId,
    startDate: bookingDateKey(o.startDate),
    endDate: bookingDateKey(o.endDate),
    guests: o.guests,
    subtotalPrice: o.subtotalPrice,
    currency: o.currency,
    status: o.status,
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  };
}

function toConversationDTO(c: any, currentUserId: string, unreadCount = 0): ConversationDTO {
  const latestMessage = Array.isArray(c.messages) && c.messages.length > 0 ? c.messages[0] : null;
  const isAlreadyBooked = Boolean(
    c.booking && c.booking.status === BookingStatus.CONFIRMED
  );
  const activeOffer = !isAlreadyBooked && Array.isArray(c.specialOffers) && c.specialOffers.length > 0
    ? c.specialOffers.find(
        (so: any) =>
          (so.status === SpecialOfferStatus.PENDING || so.status === SpecialOfferStatus.ACCEPTED) &&
          (!so.expiresAt || new Date(so.expiresAt) > new Date())
      )
    : null;
  const specialOffersList = Array.isArray(c.specialOffers)
    ? c.specialOffers.map(toSpecialOfferDTO)
    : [];

  return {
    id: c.id,
    guestId: c.guestId,
    hostId: c.hostId,
    listingId: c.listingId,
    bookingId: c.bookingId,
    type: c.type,
    status: c.status,
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : c.createdAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    unreadCount,
    guest: {
      id: c.guest.id,
      name: c.guest.name,
      image: c.guest.image,
      email: c.guest.email,
      createdAt: c.guest.createdAt ? c.guest.createdAt.toISOString() : new Date().toISOString(),
      phone: c.guest.phone || null,
      emailVerified: Boolean(c.guest.emailVerified),
      identityVerified: Boolean(
        c.guest.personalInfo?.identityStatus === "VERIFIED" ||
        c.guest.personalInfo?.identityVerified
      ),
    },
    host: {
      id: c.host.id,
      name: c.host.name,
      image: c.host.image,
      email: c.host.email,
      createdAt: c.host.createdAt ? c.host.createdAt.toISOString() : new Date().toISOString(),
    },
    listing: {
      id: c.listing.id,
      title: c.listing.title,
      photos: Array.isArray(c.listing.photos) ? c.listing.photos : [],
      city: c.listing.city || null,
      district: c.listing.district || null,
      country: c.listing.country || null,
      price: c.listing.price || 0,
      propertyType: c.listing.propertyType || null,
      roomType: c.listing.listingType || null,
      checkInStart: c.listing.checkInStart || null,
      checkOutTime: c.listing.checkOutTime || null,
      cancellationPolicy: c.listing.cancellationPolicy || null,
    },
    booking: c.booking
      ? {
          id: c.booking.id,
          status: c.booking.status,
          startDate: bookingDateKey(c.booking.startDate),
          endDate: bookingDateKey(c.booking.endDate),
          guests: c.booking.guests,
          totalPrice: c.booking.totalPrice,
          nightlyPrice: c.booking.nightlyPrice,
          currency: c.booking.currency,
          cancellationPolicy: c.booking.cancellationPolicy,
          isNonRefundable: Boolean(c.booking.isNonRefundable),
          priceBreakdown: c.booking.priceBreakdown ?? null,
          createdAt: c.booking.createdAt ? c.booking.createdAt.toISOString() : undefined,
        }
      : null,
    lastMessage: latestMessage ? toMessageDTO(latestMessage, currentUserId) : null,
    activeSpecialOffer: activeOffer ? toSpecialOfferDTO(activeOffer) : null,
    specialOffers: specialOffersList,
  };
}

/**
 * List conversations for the authenticated user with filters and search.
 */
async function listConversationsForUser(
  actor: AuthUser,
  params: {
    role?: "guest" | "host" | "all";
    filter?: "all" | "unread";
    search?: string;
    skip?: number;
    take?: number;
  } = {}
): Promise<{ conversations: ConversationDTO[]; total: number; unreadTotal: number }> {
  const roleFilter = params.role || "all";
  const userCondition: Prisma.ConversationWhereInput =
    roleFilter === "guest"
      ? { guestId: actor.id }
      : roleFilter === "host"
      ? { hostId: actor.id }
      : { OR: [{ guestId: actor.id }, { hostId: actor.id }] };

  let searchCondition: Prisma.ConversationWhereInput = {};
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    searchCondition = {
      OR: [
        { listing: { title: { contains: q, mode: "insensitive" } } },
        { guest: { name: { contains: q, mode: "insensitive" } } },
        { host: { name: { contains: q, mode: "insensitive" } } },
      ],
    };
  }

  let unreadCondition: Prisma.ConversationWhereInput = {};
  if (params.filter === "unread") {
    unreadCondition = {
      messages: {
        some: {
          readAt: null,
          senderId: { not: actor.id },
        },
      },
    };
  }

  const where: Prisma.ConversationWhereInput = {
    AND: [userCondition, searchCondition, unreadCondition],
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: params.skip || 0,
      take: params.take || 50,
      include: {
        guest: { select: { id: true, name: true, image: true, email: true, emailVerified: true, personalInfo: true, createdAt: true, phone: true } },
        host: { select: { id: true, name: true, image: true, email: true, createdAt: true } },
        listing: {
          select: {
            id: true,
            title: true,
            photos: true,
            city: true,
            district: true,
            country: true,
            price: true,
            propertyType: true,
            listingType: true,
            checkInStart: true,
            checkOutTime: true,
            cancellationPolicy: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            guests: true,
            totalPrice: true,
            nightlyPrice: true,
            currency: true,
            cancellationPolicy: true,
            isNonRefundable: true,
            priceBreakdown: true,
            createdAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, image: true, role: true } },
            attachments: true,
          },
        },
        specialOffers: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  // Compute unread counts per conversation in batch
  const conversationIds = conversations.map((c: any) => c.id);
  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversationIds },
      readAt: null,
      senderId: { not: actor.id },
    },
    _count: { id: true },
  });

  const unreadMap = new Map<string, number>();
  unreadCounts.forEach((u: any) => unreadMap.set(u.conversationId, u._count.id));

  // Compute total unread conversations across all conversations for this user
  const unreadTotal = await prisma.conversation.count({
    where: {
      AND: [
        userCondition,
        {
          messages: {
            some: {
              readAt: null,
              senderId: { not: actor.id },
            },
          },
        },
      ],
    },
  });

  return {
    conversations: conversations.map((c: any) =>
      toConversationDTO(c, actor.id, unreadMap.get(c.id) || 0)
    ),
    total,
    unreadTotal,
  };
}

/**
 * Get a single conversation by ID with full details and authorization check.
 */
async function getConversationById(
  actor: AuthUser,
  conversationId: string
): Promise<ConversationDTO> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      guest: { select: { id: true, name: true, image: true, email: true, emailVerified: true, personalInfo: true, createdAt: true, phone: true } },
      host: { select: { id: true, name: true, image: true, email: true, createdAt: true } },
      listing: {
        select: {
          id: true,
          title: true,
          photos: true,
          city: true,
          district: true,
          country: true,
          price: true,
          propertyType: true,
          listingType: true,
          checkInStart: true,
          checkOutTime: true,
          cancellationPolicy: true,
        },
      },
      booking: {
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          guests: true,
          totalPrice: true,
          nightlyPrice: true,
          currency: true,
          cancellationPolicy: true,
          isNonRefundable: true,
          priceBreakdown: true,
          createdAt: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: { select: { id: true, name: true, image: true, role: true } },
          attachments: true,
        },
      },
      specialOffers: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  // Strict authorization: participant check
  const isParticipant =
    conversation.guestId === actor.id ||
    conversation.hostId === actor.id ||
    actor.role === Role.ADMIN;

  if (!isParticipant) {
    throw AppError.forbidden("You do not have permission to access this conversation");
  }

  const unreadCount = await prisma.message.count({
    where: {
      conversationId,
      readAt: null,
      senderId: { not: actor.id },
    },
  });

  return toConversationDTO(conversation, actor.id, unreadCount);
}

/**
 * Get messages for a conversation.
 */
async function getConversationMessages(
  actor: AuthUser,
  conversationId: string,
  params: { skip?: number; take?: number } = {}
): Promise<{ messages: MessageDTO[]; total: number }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, guestId: true, hostId: true },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  if (
    conversation.guestId !== actor.id &&
    conversation.hostId !== actor.id &&
    actor.role !== Role.ADMIN
  ) {
    throw AppError.forbidden("You do not have permission to view messages in this conversation");
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip: params.skip,
      take: params.take,
      include: {
        sender: {
          select: { id: true, name: true, image: true, role: true },
        },
        attachments: true,
      },
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return {
    messages: messages.map((m: any) => toMessageDTO(m, actor.id)),
    total,
  };
}

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const ALLOWED_ATTACHMENT_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024; // 15MB

function validateAttachmentBuffer(
  buffer: Buffer,
  clientMime: string,
  originalName: string
): {
  fileType: "IMAGE" | "DOCUMENT";
  mimeType: string;
  cleanExt: string;
} {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest("Attachment file cannot be empty");
  }

  if (buffer.length > MAX_ATTACHMENT_SIZE) {
    throw AppError.badRequest("Attachment exceeds the maximum allowed size of 15MB");
  }

  const rawExt = path.extname(originalName).toLowerCase();
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(rawExt)) {
    throw AppError.badRequest(
      "Unsupported file format. Only JPG, JPEG, PNG, WEBP images and PDF documents are allowed."
    );
  }

  if (clientMime && !ALLOWED_ATTACHMENT_MIMES.has(clientMime)) {
    throw AppError.badRequest(
      "Unsupported file type. Only JPG, JPEG, PNG, WEBP images and PDF documents are allowed."
    );
  }

  // Magic bytes inspection
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  const isPdf = buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";

  if (isJpeg) {
    return { fileType: "IMAGE", mimeType: "image/jpeg", cleanExt: rawExt === ".jpeg" ? ".jpeg" : ".jpg" };
  }
  if (isPng) {
    return { fileType: "IMAGE", mimeType: "image/png", cleanExt: ".png" };
  }
  if (isWebp) {
    return { fileType: "IMAGE", mimeType: "image/webp", cleanExt: ".webp" };
  }
  if (isPdf) {
    return { fileType: "DOCUMENT", mimeType: "application/pdf", cleanExt: ".pdf" };
  }

  throw AppError.badRequest("File content does not match allowed image (JPG, PNG, WEBP) or document (PDF) formats.");
}

/**
 * Upload and stage an attachment for a conversation.
 */
async function uploadAttachment(
  actor: AuthUser,
  conversationId: string,
  file: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }
): Promise<MessageAttachmentDTO> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, guestId: true, hostId: true },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  const isParticipant =
    conversation.guestId === actor.id ||
    conversation.hostId === actor.id ||
    actor.role === Role.ADMIN;

  if (!isParticipant) {
    throw AppError.forbidden("You do not have permission to upload attachments to this conversation");
  }

  const validated = validateAttachmentBuffer(file.buffer, file.mimeType, file.fileName);

  // Sanitize original filename for display
  const baseRaw = path.basename(file.fileName, path.extname(file.fileName));
  const safeName = (baseRaw.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 80) || "file") + validated.cleanExt;

  // Server-controlled random storage filename
  const storageFileName = `att_${conversationId}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${validated.cleanExt}`;

  const saved = await savePrivateMedia({
    kind: "message-attachments",
    fileName: storageFileName,
    body: file.buffer,
    contentType: validated.mimeType,
  });

  const attachment = await prisma.messageAttachment.create({
    data: {
      conversationId,
      messageId: null,
      fileName: safeName,
      fileType: validated.fileType,
      mimeType: validated.mimeType,
      fileSize: file.buffer.length,
      storagePath: saved.storagePath,
      fileUrl: "",
    },
  });

  const fileUrl = `/api/v1/messages/attachments/${attachment.id}`;
  const updated = await prisma.messageAttachment.update({
    where: { id: attachment.id },
    data: { fileUrl },
  });

  return {
    id: updated.id,
    conversationId: updated.conversationId,
    messageId: updated.messageId,
    fileName: updated.fileName,
    fileType: updated.fileType as "IMAGE" | "DOCUMENT",
    mimeType: updated.mimeType,
    fileSize: updated.fileSize,
    fileUrl: updated.fileUrl,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Remove a staged (unattached) attachment.
 */
async function removeStagedAttachment(
  actor: AuthUser,
  conversationId: string,
  attachmentId: string
): Promise<{ success: boolean }> {
  const attachment = await prisma.messageAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      conversation: { select: { id: true, guestId: true, hostId: true } },
    },
  });

  if (!attachment || attachment.conversationId !== conversationId) {
    throw AppError.notFound("Attachment not found");
  }

  const isParticipant =
    attachment.conversation.guestId === actor.id ||
    attachment.conversation.hostId === actor.id ||
    actor.role === Role.ADMIN;

  if (!isParticipant) {
    throw AppError.forbidden("You do not have permission to remove this attachment");
  }

  if (attachment.messageId) {
    throw AppError.badRequest("Cannot remove an attachment that has already been sent");
  }

  try {
    await deletePrivateMedia({
      kind: "message-attachments",
      fileName: attachment.storagePath,
    });
  } catch (err) {
    console.warn("Failed to delete private media file:", err);
  }

  await prisma.messageAttachment.delete({
    where: { id: attachmentId },
  });

  return { success: true };
}

/**
 * Get an attachment file buffer with authorization check.
 */
async function getAttachmentFile(
  actor: AuthUser,
  attachmentId: string
): Promise<{
  attachment: {
    id: string;
    conversationId: string;
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
  };
  buffer: Buffer;
}> {
  const attachment = await prisma.messageAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      conversation: { select: { id: true, guestId: true, hostId: true } },
    },
  });

  if (!attachment) {
    throw AppError.notFound("Attachment not found");
  }

  const isParticipant =
    attachment.conversation.guestId === actor.id ||
    attachment.conversation.hostId === actor.id ||
    actor.role === Role.ADMIN;

  if (!isParticipant) {
    throw AppError.forbidden("You do not have permission to access this attachment");
  }

  let buffer: Buffer;
  try {
    buffer = await readPrivateMedia("message-attachments", attachment.storagePath);
  } catch {
    throw AppError.notFound("Attachment file not found in storage");
  }

  return {
    attachment: {
      id: attachment.id,
      conversationId: attachment.conversationId,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      storagePath: attachment.storagePath,
    },
    buffer,
  };
}

/**
 * Send a message within an existing conversation.
 */
async function sendMessage(
  actor: AuthUser,
  conversationId: string,
  input: {
    content?: string;
    type?: MessageType;
    metadata?: Record<string, unknown>;
    attachmentIds?: string[];
  }
): Promise<MessageDTO> {
  const trimmed = input.content ? input.content.trim() : "";
  const hasAttachments = Array.isArray(input.attachmentIds) && input.attachmentIds.length > 0;

  if (
    !trimmed &&
    !hasAttachments &&
    input.type !== MessageType.PRE_APPROVAL &&
    input.type !== MessageType.DECLINE
  ) {
    throw AppError.badRequest("Message must contain either text or an attachment");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      guest: { select: { id: true, name: true } },
      host: { select: { id: true, name: true } },
    },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  const isGuest = conversation.guestId === actor.id;
  const isHost = conversation.hostId === actor.id;

  if (!isGuest && !isHost && actor.role !== Role.ADMIN) {
    throw AppError.forbidden("You do not have permission to send messages in this conversation");
  }

  // If attachments are provided, verify they are staged and belong to this conversation
  let verifiedAttachments: Array<{ id: string; fileType: string; fileName: string }> = [];
  if (hasAttachments) {
    verifiedAttachments = await prisma.messageAttachment.findMany({
      where: {
        id: { in: input.attachmentIds },
        conversationId,
        messageId: null,
      },
      select: { id: true, fileType: true, fileName: true },
    });

    if (verifiedAttachments.length !== input.attachmentIds!.length) {
      throw AppError.badRequest("One or more attachments are invalid, already sent, or not found");
    }
  }

  const now = new Date();
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: actor.id,
      type: input.type || MessageType.TEXT,
      content: trimmed,
      metadata: (input.metadata as Prisma.InputJsonValue) || undefined,
      createdAt: now,
    },
    include: {
      sender: {
        select: { id: true, name: true, image: true, role: true },
      },
    },
  });

  // Link attachments to the new message
  if (hasAttachments) {
    await prisma.messageAttachment.updateMany({
      where: { id: { in: input.attachmentIds } },
      data: { messageId: message.id },
    });
  }

  // Update conversation lastMessageAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now },
  });

  // Calculate notification & preview text
  let messagePreview = trimmed.slice(0, 120);
  if (!messagePreview && hasAttachments) {
    const hasImage = verifiedAttachments.some((a) => a.fileType === "IMAGE");
    if (hasImage) {
      messagePreview = verifiedAttachments.length > 1 ? "Sent photos" : "Sent a photo";
    } else {
      messagePreview = verifiedAttachments.length > 1 ? "Sent files" : "Sent a file";
    }
  }

  // Notify recipient
  const recipientId = isGuest ? conversation.hostId : conversation.guestId;
  const senderName = actor.name || (isGuest ? "Guest" : "Host");
  try {
    await notificationService.sendMessageNotification({
      recipientUserId: recipientId,
      senderName,
      messagePreview,
      conversationId,
      isHostRecipient: recipientId === conversation.hostId,
    });
  } catch (err) {
    console.error("Failed to dispatch message notification:", err);
  }

  const messageWithAttachments = await prisma.message.findUnique({
    where: { id: message.id },
    include: {
      sender: {
        select: { id: true, name: true, image: true, role: true },
      },
      attachments: true,
    },
  });

  return toMessageDTO(messageWithAttachments || message, actor.id);
}

/**
 * Mark all incoming messages in a conversation as read.
 */
async function markConversationRead(
  actor: AuthUser,
  conversationId: string
): Promise<{ markedRead: number }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, guestId: true, hostId: true },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  if (
    conversation.guestId !== actor.id &&
    conversation.hostId !== actor.id &&
    actor.role !== Role.ADMIN
  ) {
    throw AppError.forbidden("You do not have permission to modify this conversation");
  }

  const now = new Date();
  const updateResult = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: actor.id },
      readAt: null,
    },
    data: {
      readAt: now,
    },
  });

  // Also mark message notifications for this conversation as read
  try {
    await prisma.notification.updateMany({
      where: {
        userId: actor.id,
        entityId: conversationId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });
  } catch (err) {
    console.error("Failed to mark notifications read for conversation:", err);
  }

  return { markedRead: updateResult.count };
}

/**
 * Create a guest -> host pre-booking inquiry conversation.
 */
async function createInquiryConversation(
  actor: AuthUser,
  input: {
    listingId: string;
    message: string;
    startDate?: string;
    endDate?: string;
    guests?: number;
  }
): Promise<{ conversation: ConversationDTO; message: MessageDTO }> {
  const trimmed = input.message.trim();
  if (!trimmed) {
    throw AppError.badRequest("Inquiry message cannot be empty");
  }

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, hostId: true, title: true, status: true, published: true },
  });

  if (!listing || !listing.published || listing.status !== ListingStatus.ACTIVE) {
    throw AppError.notFound("Listing is not available or does not exist");
  }

  if (listing.hostId === actor.id) {
    throw AppError.badRequest("Hosts cannot message themselves regarding their own listing");
  }

  const now = new Date();

  // Find or create conversation for guest + host + listing
  let conversation = await prisma.conversation.findFirst({
    where: {
      guestId: actor.id,
      hostId: listing.hostId,
      listingId: listing.id,
      bookingId: null,
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        guestId: actor.id,
        hostId: listing.hostId,
        listingId: listing.id,
        type: ConversationType.INQUIRY,
        status: ConversationStatus.ACTIVE,
        lastMessageAt: now,
      },
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: actor.id,
      type: MessageType.TEXT,
      content: trimmed,
      metadata: {
        inquiry: true,
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        guests: input.guests || null,
      },
      createdAt: now,
    },
    include: {
      sender: { select: { id: true, name: true, image: true, role: true } },
    },
  });

  // Notify host
  try {
    const senderName = actor.name || "A guest";
    await notificationService.sendHostMessageNotification({
      recipientUserId: listing.hostId,
      senderName,
      messagePreview: `New inquiry for ${listing.title}: "${trimmed.slice(0, 100)}"`,
      conversationId: conversation.id,
    });
  } catch (err) {
    console.error("Failed to notify host for new inquiry:", err);
  }

  const fullConversation = await getConversationById(actor, conversation.id);
  return {
    conversation: fullConversation,
    message: toMessageDTO(message, actor.id),
  };
}

/**
 * Get or create a conversation linked to a booking (e.g. from Request to Book or instant booking).
 */
async function getOrCreateBookingConversation(params: {
  guestId: string;
  hostId: string;
  listingId: string;
  bookingId: string;
  messageContent?: string;
  isConfirmed?: boolean;
  guestName?: string;
  db?: Prisma.TransactionClient;
}): Promise<{ conversationId: string; messageId?: string }> {
  const now = new Date();
  const db = params.db ?? prisma;
  const checkoutMessage = params.messageContent?.trim();
  if (checkoutMessage && checkoutMessage.length > HOST_MESSAGE_MAX_LENGTH) {
    throw AppError.badRequest(`Message cannot exceed ${HOST_MESSAGE_MAX_LENGTH} characters`);
  }

  // Look for conversation with this bookingId first
  let conversation = await db.conversation.findFirst({
    where: { bookingId: params.bookingId },
  });

  if (!conversation) {
    // Look for an existing inquiry conversation between this guest, host, listing without bookingId
    conversation = await db.conversation.findFirst({
      where: {
        guestId: params.guestId,
        hostId: params.hostId,
        listingId: params.listingId,
        bookingId: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (conversation) {
      conversation = await db.conversation.update({
        where: { id: conversation.id },
        data: {
          bookingId: params.bookingId,
          type: params.isConfirmed ? ConversationType.BOOKING : ConversationType.BOOKING_REQUEST,
          status: params.isConfirmed ? ConversationStatus.CONFIRMED : ConversationStatus.ACTIVE,
          lastMessageAt: now,
        },
      });
    } else {
      conversation = await db.conversation.create({
        data: {
          guestId: params.guestId,
          hostId: params.hostId,
          listingId: params.listingId,
          bookingId: params.bookingId,
          type: params.isConfirmed ? ConversationType.BOOKING : ConversationType.BOOKING_REQUEST,
          status: params.isConfirmed ? ConversationStatus.CONFIRMED : ConversationStatus.ACTIVE,
          lastMessageAt: now,
        },
      });
    }
  }

  let createdMessageId: string | undefined;

  // If checkout included a message to host, insert it into the conversation
  if (checkoutMessage) {
    const msg = await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: params.guestId,
        type: MessageType.BOOKING_REQUEST,
        content: checkoutMessage,
        metadata: {
          bookingId: params.bookingId,
          isRequestToBook: !params.isConfirmed,
        },
        createdAt: now,
      },
    });
    createdMessageId = msg.id;

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });
  }

  return {
    conversationId: conversation.id,
    messageId: createdMessageId,
  };
}

/**
 * Record a system status change message in the conversation thread.
 */
async function recordBookingStatusMessage(params: {
  bookingId: string;
  statusText: string;
  newBookingStatus: BookingStatus;
  conversationStatus?: ConversationStatus;
}): Promise<void> {
  const conversation = await prisma.conversation.findFirst({
    where: { bookingId: params.bookingId },
  });

  if (!conversation) return;

  const now = new Date();
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: null, // System message
      type: MessageType.BOOKING_STATUS,
      content: params.statusText,
      metadata: {
        bookingId: params.bookingId,
        status: params.newBookingStatus,
      },
      createdAt: now,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: params.conversationStatus || (params.newBookingStatus === BookingStatus.CONFIRMED ? ConversationStatus.CONFIRMED : params.newBookingStatus === BookingStatus.CANCELLED ? ConversationStatus.CANCELLED : ConversationStatus.ACTIVE),
      lastMessageAt: now,
    },
  });
}

/**
 * Host pre-approves an inquiry conversation.
 */
async function preApproveInquiry(
  actor: AuthUser,
  conversationId: string,
  input?: { messageText?: string }
): Promise<ConversationDTO> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { listing: { select: { title: true } } },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  if (conversation.hostId !== actor.id && actor.role !== Role.ADMIN) {
    throw AppError.forbidden("Only the host can pre-approve an inquiry");
  }

  const now = new Date();
  const defaultText = `Good news! I have pre-approved your reservation inquiry for ${conversation.listing.title}. You can now complete your booking.`;
  const content = (input?.messageText && input.messageText.trim()) || defaultText;

  await prisma.message.create({
    data: {
      conversationId,
      senderId: actor.id,
      type: MessageType.PRE_APPROVAL,
      content,
      metadata: {
        preApprovedAt: now.toISOString(),
      },
      createdAt: now,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.PRE_APPROVED,
      lastMessageAt: now,
    },
  });

  // Notify guest
  try {
    await notificationService.sendMessageNotification({
      recipientUserId: conversation.guestId,
      senderName: actor.name || "Host",
      messagePreview: content,
      conversationId,
      isHostRecipient: false,
    });
  } catch (err) {
    console.error("Failed to notify guest of pre-approval:", err);
  }

  return getConversationById(actor, conversationId);
}

/**
 * Host sends a special offer to the guest.
 */
async function sendSpecialOffer(
  actor: AuthUser,
  conversationId: string,
  input: {
    startDate: string;
    endDate: string;
    guests: number;
    subtotalPrice: number;
    currency?: string;
    messageText?: string;
    listingId?: string;
  }
): Promise<{ specialOffer: SpecialOfferDTO; message: MessageDTO }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { listing: { select: { title: true } } },

  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  if (conversation.hostId !== actor.id && actor.role !== Role.ADMIN) {
    throw AppError.forbidden("Only the host can send a special offer");
  }

  if (input.subtotalPrice <= 0) {
    throw AppError.badRequest("Special offer subtotal price must be greater than 0");
  }

  const start = parseBookingDate(input.startDate);
  const end = parseBookingDate(input.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    throw AppError.badRequest("Invalid stay dates for special offer");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours expiry
  const currency = input.currency || "SAR";

  // Invalidate any prior pending special offers for this conversation
  await prisma.specialOffer.updateMany({
    where: {
      conversationId,
      status: SpecialOfferStatus.PENDING,
    },
    data: {
      status: SpecialOfferStatus.EXPIRED,
    },
  });

  const offer = await prisma.specialOffer.create({
    data: {
      conversationId,
      hostId: actor.id,
      guestId: conversation.guestId,
      listingId: input.listingId || conversation.listingId,
      startDate: start,
      endDate: end,
      guests: input.guests || 1,
      subtotalPrice: Math.round(input.subtotalPrice),
      currency,
      status: SpecialOfferStatus.PENDING,
      expiresAt,
      createdAt: now,
    },
  });

  const messageText =
    (input.messageText && input.messageText.trim()) ||
    `Special Offer: ${currency} ${(input.subtotalPrice / 100).toFixed(2)} for ${input.guests || 1} guest(s) from ${input.startDate} to ${input.endDate}. Offer expires in 24 hours.`;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: actor.id,
      type: MessageType.SPECIAL_OFFER,
      content: messageText,
      metadata: {
        specialOfferId: offer.id,
        subtotalPrice: offer.subtotalPrice,
        currency: offer.currency,
        startDate: input.startDate,
        endDate: input.endDate,
        guests: offer.guests,
        expiresAt: expiresAt.toISOString(),
      },
      createdAt: now,
    },
    include: {
      sender: { select: { id: true, name: true, image: true, role: true } },
    },
  });

  await prisma.specialOffer.update({
    where: { id: offer.id },
    data: { messageId: message.id },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.SPECIAL_OFFER_SENT,
      lastMessageAt: now,
    },
  });

  // Notify guest
  try {
    await notificationService.sendMessageNotification({
      recipientUserId: conversation.guestId,
      senderName: actor.name || "Host",
      messagePreview: `Special offer received: ${messageText}`,
      conversationId,
      isHostRecipient: false,
    });
  } catch (err) {
    console.error("Failed to notify guest of special offer:", err);
  }

  return {
    specialOffer: toSpecialOfferDTO(offer),
    message: toMessageDTO(message, actor.id),
  };
}

/**
 * Guest accepts special offer - returns booking checkout redirect details.
 */
async function acceptSpecialOffer(
  actor: AuthUser,
  conversationId: string,
  specialOfferId: string
): Promise<{ specialOffer: SpecialOfferDTO; checkoutUrl: string }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  if (conversation.guestId !== actor.id && actor.role !== Role.ADMIN) {
    throw AppError.forbidden("Only the guest can accept this special offer");
  }

  const offer = await prisma.specialOffer.findUnique({
    where: { id: specialOfferId },
  });

  if (!offer || offer.conversationId !== conversationId) {
    throw AppError.notFound("Special offer not found");
  }

  if (offer.expiresAt && offer.expiresAt < new Date()) {
    await prisma.specialOffer.update({
      where: { id: offer.id },
      data: { status: SpecialOfferStatus.EXPIRED },
    });
    throw AppError.badRequest("This special offer has expired");
  }

  const checkinStr = bookingDateKey(offer.startDate);
  const checkoutStr = bookingDateKey(offer.endDate);
  const checkoutUrl = `/book/${offer.listingId}?checkIn=${checkinStr}&checkOut=${checkoutStr}&guests=${offer.guests}&specialOfferId=${offer.id}`;

  // If already accepted, return checkoutUrl idempotently
  if (offer.status === SpecialOfferStatus.ACCEPTED) {
    return {
      specialOffer: toSpecialOfferDTO(offer),
      checkoutUrl,
    };
  }

  if (offer.status !== SpecialOfferStatus.PENDING) {
    throw AppError.badRequest(`This special offer is already ${offer.status.toLowerCase()}`);
  }

  const updatedOffer = await prisma.specialOffer.update({
    where: { id: offer.id },
    data: { status: SpecialOfferStatus.ACCEPTED },
  });

  const now = new Date();
  await prisma.message.create({
    data: {
      conversationId,
      senderId: actor.id,
      type: MessageType.SYSTEM,
      content: `Guest accepted the special offer for ${offer.currency} ${(offer.subtotalPrice / 100).toFixed(2)}. Proceeding to checkout.`,
      metadata: {
        specialOfferId: offer.id,
        acceptedAt: now.toISOString(),
      },
      createdAt: now,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.ACTIVE,
      lastMessageAt: now,
    },
  });

  return {
    specialOffer: toSpecialOfferDTO(updatedOffer),
    checkoutUrl,
  };
}

/**
 * Host declines an inquiry.
 */
async function declineInquiry(
  actor: AuthUser,
  conversationId: string,
  input?: { reason?: string; messageText?: string }
): Promise<ConversationDTO> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw AppError.notFound("Conversation not found");
  }

  if (conversation.hostId !== actor.id && actor.role !== Role.ADMIN) {
    throw AppError.forbidden("Only the host can decline an inquiry");
  }

  const now = new Date();
  const reasonText = input?.reason ? ` (Reason: ${input.reason})` : "";
  const content =
    (input?.messageText && input.messageText.trim()) ||
    `Host is unable to accommodate this stay request at this time.${reasonText}`;

  await prisma.message.create({
    data: {
      conversationId,
      senderId: actor.id,
      type: MessageType.DECLINE,
      content,
      metadata: {
        reason: input?.reason || null,
        declinedAt: now.toISOString(),
      },
      createdAt: now,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.DECLINED,
      lastMessageAt: now,
    },
  });

  // Notify guest
  try {
    await notificationService.sendMessageNotification({
      recipientUserId: conversation.guestId,
      senderName: actor.name || "Host",
      messagePreview: content,
      conversationId,
      isHostRecipient: false,
    });
  } catch (err) {
    console.error("Failed to notify guest of inquiry decline:", err);
  }

  return getConversationById(actor, conversationId);
}

export interface HostResponseMetrics {
  totalGuestInquiries: number;
  respondedCount: number;
  respondedWithin24hCount: number;
  // A rate cannot be inferred until there has been at least one guest inquiry.
  responseRatePercentage: number | null;
  averageResponseTimeMinutes: number | null;
}

/**
 * Calculates authoritative host response metrics for guest inquiries over a rolling window.
 * Evaluates whether the host replied within the 24-hour SLA required for Superhost.
 */
async function calculateHostResponseMetrics(
  hostId: string,
  window: { windowStart: Date; windowEndExclusive: Date },
): Promise<HostResponseMetrics> {
  const conversations = await prisma.conversation.findMany({
    where: {
      hostId,
      // The Superhost evaluator supplies its single canonical 12-month
      // period. This avoids a separate rolling-month boundary for messaging.
      createdAt: { gte: window.windowStart, lt: window.windowEndExclusive },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          senderId: true,
          type: true,
          createdAt: true,
        },
      },
    },
  });

  let totalGuestInquiries = 0;
  let respondedCount = 0;
  let respondedWithin24hCount = 0;
  let totalResponseTimeMinutes = 0;
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  for (const conv of conversations) {
    if (!conv.messages || conv.messages.length === 0) continue;

    // Count the first actual guest-authored inquiry in the conversation,
    // never a sender-less system event. The existing conversation model has
    // no separate inquiry entity; subsequent guest messages before a reply
    // remain part of this same inquiry rather than becoming duplicate SLA rows.
    const firstGuestMsg = conv.messages.find(
      (m: { id: string; senderId: string | null; type: string; createdAt: Date }) =>
        m.senderId === conv.guestId && m.type !== "SYSTEM",
    );
    if (!firstGuestMsg) continue;

    totalGuestInquiries++;

    // Find the first host reply following the guest's message
    const firstHostReply = conv.messages.find(
      (m: { id: string; senderId: string | null; createdAt: Date }) =>
        m.senderId === hostId && m.createdAt > firstGuestMsg.createdAt,
    );

    if (firstHostReply) {
      respondedCount++;
      const responseTimeMs = firstHostReply.createdAt.getTime() - firstGuestMsg.createdAt.getTime();
      const responseTimeMinutes = Math.max(1, Math.round(responseTimeMs / (60 * 1000)));
      totalResponseTimeMinutes += responseTimeMinutes;

      if (responseTimeMs <= TWENTY_FOUR_HOURS_MS) {
        respondedWithin24hCount++;
      }
    }
  }

  const responseRatePercentage =
    totalGuestInquiries > 0
      // Keep comparison precision intact for the >= 90% Superhost threshold.
      // Formatting belongs at the presentation boundary, not the rules engine.
      ? (respondedWithin24hCount / totalGuestInquiries) * 100
      : null;

  const averageResponseTimeMinutes =
    respondedCount > 0 ? Math.round(totalResponseTimeMinutes / respondedCount) : null;

  return {
    totalGuestInquiries,
    respondedCount,
    respondedWithin24hCount,
    responseRatePercentage,
    averageResponseTimeMinutes,
  };
}

export const messagingService = {
  listConversationsForUser,
  getConversationById,
  getConversationMessages,
  sendMessage,
  uploadAttachment,
  removeStagedAttachment,
  getAttachmentFile,
  markConversationRead,
  createInquiryConversation,
  getOrCreateBookingConversation,
  recordBookingStatusMessage,
  preApproveInquiry,
  sendSpecialOffer,
  acceptSpecialOffer,
  declineInquiry,
  calculateHostResponseMetrics,
};
