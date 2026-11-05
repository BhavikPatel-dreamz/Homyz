import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "homyz_analytics_session";

type StoredEventType =
  | "LISTING_VIEW"
  | "SEARCH_IMPRESSION"
  | "INQUIRY"
  | "INQUIRY_TO_CONFIRMED_BOOKING"
  | "BOOKING_INTENT"
  | "CONFIRMED_BOOKING"
  | "UNATTRIBUTED_CONFIRMED_BOOKING";

const eventTypeForClientEvent: Record<string, StoredEventType | undefined> = {
  listing_page_view: "LISTING_VIEW",
  property_card_view: "SEARCH_IMPRESSION",
  booking_flow_started: "BOOKING_INTENT",
  reserve_clicked: "BOOKING_INTENT",
};

const hash = (value: string) =>
  createHash("sha256")
    .update(`${process.env.LISTING_ANALYTICS_HASH_SALT || "homyz-listing-analytics"}:${value}`)
    .digest("hex");

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

function validSessionId(value: string | null | undefined) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,160}$/.test(value)
    ? value
    : null;
}

function isObviousBot(userAgent: string | null) {
  return /bot|crawler|spider|slurp|headless|lighthouse|preview/i.test(userAgent || "");
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(key)
      && (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null))
    .slice(0, 12)
    .map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 120) : item]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function readAnalyticsSessionId(cookieHeader: string | null) {
  const raw = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  return validSessionId(raw ? decodeURIComponent(raw) : null);
}

export async function recordListingAnalyticsEvent(input: {
  clientEventType: string;
  listingId: string | null;
  sessionId: string | null;
  userAgent: string | null;
  metadata?: unknown;
}) {
  const eventType = eventTypeForClientEvent[input.clientEventType];
  const sessionId = validSessionId(input.sessionId);
  if (!eventType || !input.listingId || !sessionId || isObviousBot(input.userAgent)) {
    return { recorded: false };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, hostId: true, published: true, deletedAt: true },
  });
  if (!listing || !listing.published || listing.deletedAt) return { recorded: false };

  const occurredAt = new Date();
  const sessionHash = hash(sessionId);
  const dedupeKey = hash(`${eventType}:${listing.id}:${sessionHash}:${dayKey(occurredAt)}`);
  try {
    await prisma.listingAnalyticsEvent.create({
      data: {
        eventType,
        listingId: listing.id,
        hostId: listing.hostId,
        sessionHash,
        dedupeKey,
        metadata: safeMetadata(input.metadata),
        occurredAt,
      },
    });
    return { recorded: true };
  } catch (error: unknown) {
    // A unique dedupe collision is expected when a visitor revisits a listing.
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return { recorded: false, deduplicated: true };
    }
    throw error;
  }
}

export async function recordConfirmedBookingAnalyticsEvent(input: {
  bookingId: string;
  sessionId: string | null;
}) {
  const sessionId = validSessionId(input.sessionId);
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      listingId: true,
      userId: true,
      status: true,
      createdAt: true,
      listing: { select: { hostId: true } },
      conversations: {
        select: { id: true, guestId: true, listingId: true },
      },
    },
  });
  if (!booking || booking.status !== "CONFIRMED") return { recorded: false, attributed: false };

  const sessionHash = sessionId ? hash(sessionId) : null;
  const viewed = sessionHash
    ? await prisma.listingAnalyticsEvent.findFirst({
        where: {
          eventType: "LISTING_VIEW",
          listingId: booking.listingId,
          sessionHash,
          occurredAt: {
            lte: booking.createdAt,
            gte: new Date(booking.createdAt.getTime() - ATTRIBUTION_WINDOW_MS),
          },
        },
        select: { id: true },
      })
    : null;
  const inquiryConversation = booking.conversations.find(
    (conversation) => conversation.guestId === booking.userId && conversation.listingId === booking.listingId,
  );
  const inquiryEvent = inquiryConversation
    ? await prisma.listingAnalyticsEvent.findFirst({
        where: {
          eventType: "INQUIRY",
          listingId: booking.listingId,
          visitorHash: hash(`guest:${booking.userId}`),
          dedupeKey: hash(`inquiry:${inquiryConversation.id}`),
        },
        select: { id: true },
      })
    : null;
  const eventType: StoredEventType = viewed ? "CONFIRMED_BOOKING" : "UNATTRIBUTED_CONFIRMED_BOOKING";
  try {
    const created = await prisma.listingAnalyticsEvent.create({
      data: {
        eventType,
        listingId: booking.listingId,
        hostId: booking.listing.hostId,
        sessionHash,
        dedupeKey: hash(`booking:${booking.id}`),
        metadata: { attributionWindowDays: 30 },
      },
    });
    if (inquiryEvent && inquiryConversation) {
      await prisma.listingAnalyticsEvent.upsert({
        where: { dedupeKey: hash(`inquiry-booking:${inquiryConversation.id}:${booking.id}`) },
        update: {},
        create: {
          eventType: "INQUIRY_TO_CONFIRMED_BOOKING",
          listingId: booking.listingId,
          hostId: booking.listing.hostId,
          visitorHash: hash(`guest:${booking.userId}`),
          dedupeKey: hash(`inquiry-booking:${inquiryConversation.id}:${booking.id}`),
          metadata: { attribution: "linked_inquiry_conversation" },
        },
      });
    }
    return { recorded: Boolean(created), attributed: Boolean(viewed), inquiryAttributed: Boolean(inquiryEvent) };
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return { recorded: false, attributed: Boolean(viewed), inquiryAttributed: Boolean(inquiryEvent) };
    }
    throw error;
  }
}

/**
 * Records a newly created guest inquiry as a durable host-side funnel stage.
 * A later booking is attributed only when its booking-linked conversation has
 * the existing durable INQUIRY event created for that exact conversation. No
 * historic inference is attempted; raw guest identifiers and browser session
 * IDs are never stored.
 */
export async function recordInquiryAnalyticsEvent(input: {
  conversationId: string;
  listingId: string;
  hostId: string;
  guestId: string;
}) {
  try {
    await prisma.listingAnalyticsEvent.create({
      data: {
        eventType: "INQUIRY",
        listingId: input.listingId,
        hostId: input.hostId,
        visitorHash: hash(`guest:${input.guestId}`),
        dedupeKey: hash(`inquiry:${input.conversationId}`),
        metadata: { source: "guest_inquiry" },
      },
    });
    return { recorded: true };
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return { recorded: false, deduplicated: true };
    }
    throw error;
  }
}

export type ListingAnalyticsSummary = {
  status: "ACTIVE" | "DATA_UNAVAILABLE";
  message: string;
  trackingStartedAt: string | null;
  listingViews: number;
  searchImpressions: number;
  attributedConfirmedBookings: number;
  convertedSessionsCount: number;
  uniqueViewingSessionsCount: number;
  inquiries: number;
  attributedInquiryToBookingCount: number;
  conversionRatePercentage: number | null;
  viewToInquiryRatePercentage: number | null;
};

export async function getListingAnalyticsSummary(input: {
  listingIds: string[];
  startDate: Date;
  endDate: Date;
}): Promise<ListingAnalyticsSummary> {
  if (!input.listingIds.length) {
    return {
      status: "ACTIVE",
      message: "No listings are selected.",
      trackingStartedAt: null,
      listingViews: 0,
      searchImpressions: 0,
      attributedConfirmedBookings: 0,
      convertedSessionsCount: 0,
      uniqueViewingSessionsCount: 0,
      inquiries: 0,
      attributedInquiryToBookingCount: 0,
      conversionRatePercentage: null,
      viewToInquiryRatePercentage: null,
    };
  }
  try {
    const [counts, firstEvent, viewingSessions, bookingEvents] = await Promise.all([
      prisma.listingAnalyticsEvent.groupBy({
        by: ["eventType"],
        where: {
          listingId: { in: input.listingIds },
          isBot: false,
          occurredAt: { gte: input.startDate, lte: input.endDate },
        },
        _count: { _all: true },
      }),
      prisma.listingAnalyticsEvent.findFirst({
        where: { listingId: { in: input.listingIds }, isBot: false },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true },
      }),
      prisma.listingAnalyticsEvent.findMany({
        where: {
          listingId: { in: input.listingIds },
          eventType: "LISTING_VIEW",
          isBot: false,
          occurredAt: { gte: input.startDate, lte: input.endDate },
          sessionHash: { not: null },
        },
        distinct: ["sessionHash"],
        select: { sessionHash: true },
      }),
      prisma.listingAnalyticsEvent.findMany({
        where: {
          listingId: { in: input.listingIds },
          eventType: "CONFIRMED_BOOKING",
          isBot: false,
          occurredAt: { gte: input.startDate, lte: input.endDate },
          sessionHash: { not: null },
        },
        select: { sessionHash: true },
      }),
    ]);

    const count = (eventType: StoredEventType) => counts.find((row) => row.eventType === eventType)?._count._all ?? 0;
    const listingViews = count("LISTING_VIEW");
    const attributedConfirmedBookings = count("CONFIRMED_BOOKING");
    const inquiries = count("INQUIRY");
    const attributedInquiryToBookingCount = count("INQUIRY_TO_CONFIRMED_BOOKING");

    const viewingSessionSet = new Set(
      viewingSessions.map((s) => s.sessionHash).filter((h): h is string => Boolean(h)),
    );
    const uniqueViewingSessionsCount = viewingSessionSet.size;

    // Converted sessions: viewing sessions in this window that generated at least one confirmed booking
    const convertedSessionSet = new Set<string>();
    for (const b of bookingEvents) {
      if (b.sessionHash && viewingSessionSet.has(b.sessionHash)) {
        convertedSessionSet.add(b.sessionHash);
      }
    }
    const convertedSessionsCount = convertedSessionSet.size;

    // True cohort conversion: converted viewing sessions / total viewing sessions
    const conversionDenominator = uniqueViewingSessionsCount > 0 ? uniqueViewingSessionsCount : listingViews;
    const conversionRatePercentage = conversionDenominator > 0
      ? Math.min(100, Math.round((convertedSessionsCount / conversionDenominator) * 10_000) / 100)
      : null;

    const viewToInquiryRatePercentage = conversionDenominator > 0
      ? Math.min(100, Math.round((inquiries / conversionDenominator) * 10_000) / 100)
      : null;

    return {
      status: "ACTIVE",
      message: firstEvent
        ? "Observed first-party listing traffic. Repeated views are deduplicated by listing, session, and day."
        : "Tracking is active. Data will appear after eligible listing traffic is recorded.",
      trackingStartedAt: firstEvent?.occurredAt.toISOString() ?? null,
      listingViews,
      searchImpressions: count("SEARCH_IMPRESSION"),
      attributedConfirmedBookings,
      convertedSessionsCount,
      uniqueViewingSessionsCount,
      inquiries,
      attributedInquiryToBookingCount,
      conversionRatePercentage,
      viewToInquiryRatePercentage,
    };
  } catch {
    // Deployments that have not applied the additive telemetry migration remain usable.
    return {
      status: "DATA_UNAVAILABLE",
      message: "Listing analytics storage is not available in this deployment yet.",
      trackingStartedAt: null,
      listingViews: 0,
      searchImpressions: 0,
      attributedConfirmedBookings: 0,
      convertedSessionsCount: 0,
      uniqueViewingSessionsCount: 0,
      inquiries: 0,
      attributedInquiryToBookingCount: 0,
      conversionRatePercentage: null,
      viewToInquiryRatePercentage: null,
    };
  }
}
