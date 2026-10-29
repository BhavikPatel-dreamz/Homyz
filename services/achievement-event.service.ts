import { Prisma } from "@/generated/prisma/client";
import {
  AchievementEventStatus,
  AchievementEventType,
  BookingStatus,
  BookingVisitEvidenceStatus,
  ReviewDirection,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { normalizeCityName, normalizeCountry, getOrCreateDestination } from "@/services/travel-destination.service";
import { enqueueJob } from "@/services/job-queue.service";

type EventDb = Prisma.TransactionClient | typeof prisma;

export const ACHIEVEMENT_EVENT_SCHEMA_VERSION = 1;

/**
 * Phase 2 deliberately has no activation path. A future approved phase must
 * replace this function and introduce the associated commercial/tier policy.
 */
export function isAutomaticAchievementAwardingEnabled(): false {
  return false;
}

export interface TrustedAchievementEventInput {
  type: AchievementEventType;
  sourceEntityType: "BOOKING" | "REVIEW" | "REFERRAL" | "REFUND";
  sourceEntityId: string;
  userId?: string | null;
  bookingId?: string | null;
  reviewId?: string | null;
  occurredAt: Date;
  sourceVersion?: string | null;
  idempotencyKey: string;
  evidenceReference?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function recordTrustedAchievementEvent(
  input: TrustedAchievementEventInput,
  db: EventDb = prisma,
) {
  try {
    return await db.achievementEvent.create({
      data: {
        type: input.type,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        userId: input.userId ?? null,
        bookingId: input.bookingId ?? null,
        reviewId: input.reviewId ?? null,
        occurredAt: input.occurredAt,
        schemaVersion: ACHIEVEMENT_EVENT_SCHEMA_VERSION,
        sourceVersion: input.sourceVersion ?? null,
        idempotencyKey: input.idempotencyKey,
        evidenceReference: input.evidenceReference ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
    const existing = await db.achievementEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    throw error;
  }
}

export async function recordBookingConfirmedEvent(
  db: EventDb,
  booking: { id: string; userId: string; createdAt: Date; updatedAt: Date },
) {
  return recordTrustedAchievementEvent({
    type: AchievementEventType.BOOKING_CONFIRMED,
    sourceEntityType: "BOOKING",
    sourceEntityId: booking.id,
    bookingId: booking.id,
    userId: booking.userId,
    occurredAt: booking.updatedAt,
    sourceVersion: booking.updatedAt.toISOString(),
    idempotencyKey: `achievement:booking-confirmed:${booking.id}`,
    metadata: { capture: "transactional-booking-confirmation" },
  }, db);
}

export async function recordReviewPublishedEvent(
  db: EventDb,
  review: {
    id: string;
    authorId: string;
    targetUserId: string | null;
    bookingId: string | null;
    direction: ReviewDirection;
    publishedAt: Date | null;
    updatedAt: Date;
  },
) {
  const type = review.direction === ReviewDirection.HOST_TO_GUEST
    ? AchievementEventType.HOST_RATING_PUBLISHED
    : AchievementEventType.REVIEW_PUBLISHED;
  return recordTrustedAchievementEvent({
    type,
    sourceEntityType: "REVIEW",
    sourceEntityId: review.id,
    bookingId: review.bookingId,
    reviewId: review.id,
    // Guest-reputation rules belong to the reviewed guest, while a guest's
    // property review belongs to its author.
    userId: review.direction === ReviewDirection.HOST_TO_GUEST
      ? review.targetUserId
      : review.authorId,
    occurredAt: review.publishedAt ?? review.updatedAt,
    sourceVersion: review.updatedAt.toISOString(),
    // A moderation/revision changes the authoritative eligibility input and
    // therefore needs its own idempotent evaluation event. Re-delivery of the
    // same revision still resolves to this one outbox row.
    idempotencyKey: `achievement:review-published:${review.id}:${review.updatedAt.toISOString()}`,
    metadata: { direction: review.direction, capture: "transactional-review-revision" },
  }, db);
}

/** Queue failure never rolls back the already-committed outbox event. */
export async function enqueueAchievementEventProcessing(eventId: string): Promise<void> {
  await enqueueJob({
    type: "ACHIEVEMENT_EVENT_PROCESSING",
    payload: { eventId },
    idempotencyKey: `achievement-event:${eventId}`,
    priority: 1,
    maxAttempts: 5,
    backoffSeconds: 30,
    requireDurable: true,
  });
}

function validateTrustedEvent(event: {
  type: AchievementEventType;
  sourceEntityType: string;
  sourceEntityId: string;
  bookingId: string | null;
  reviewId: string | null;
}) {
  if (!event.sourceEntityId) throw new Error("Achievement event has no source entity id.");
  if (event.type === AchievementEventType.STAY_COMPLETION_CANDIDATE && !event.bookingId) {
    throw new Error("Stay completion candidate requires a booking source.");
  }
  if (
    (event.type === AchievementEventType.REVIEW_PUBLISHED || event.type === AchievementEventType.HOST_RATING_PUBLISHED) &&
    (!event.reviewId || event.sourceEntityType !== "REVIEW")
  ) {
    throw new Error("Published-review event has an invalid authoritative source.");
  }
}

async function materializeBookingCandidateEvidence(event: {
  id: string;
  bookingId: string | null;
  userId: string | null;
}) {
  if (!event.bookingId) throw new Error("Candidate event is missing bookingId.");
  const booking = await prisma.booking.findUnique({
    where: { id: event.bookingId },
    include: { listing: { select: { id: true, city: true, country: true } } },
  });
  if (!booking) throw new Error("Candidate event booking no longer exists.");
  if (!event.userId || event.userId !== booking.userId) {
    throw new Error("Candidate event user does not match its booking.");
  }

  const normalizedCountry = normalizeCountry(booking.listing.country);
  const cityName = normalizeCityName(booking.listing.city);
  const destination = normalizedCountry
    ? await getOrCreateDestination({ ...normalizedCountry, cityName })
    : null;

  const status = booking.status !== BookingStatus.CONFIRMED
    ? BookingVisitEvidenceStatus.INVALIDATED
    : destination
      ? BookingVisitEvidenceStatus.CANDIDATE
      : BookingVisitEvidenceStatus.UNSUPPORTED;

  return prisma.bookingVisitEvidence.upsert({
    where: { bookingId: booking.id },
    create: {
      userId: booking.userId,
      bookingId: booking.id,
      listingId: booking.listingId,
      destinationId: destination?.id ?? null,
      countryCode: normalizedCountry?.countryCode ?? null,
      countryName: normalizedCountry?.countryName ?? null,
      cityName,
      checkInDate: booking.startDate,
      checkOutDate: booking.endDate,
      bookingStatus: booking.status,
      status,
      sourceEventId: event.id,
      metadata: {
        capture: "phase-2-candidate-only",
        sourceStatus: booking.status,
        invalidatedBecause: booking.status !== BookingStatus.CONFIRMED
          ? "BOOKING_NO_LONGER_CONFIRMED"
          : null,
      },
    },
    // A prior evidence row may already be qualified or invalidated by a future
    // policy. This Phase 2 worker must never overwrite that decision.
    update: {},
  });
}

export async function processAchievementEvent(eventId: string, workerId: string) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claim = await prisma.achievementEvent.updateMany({
    where: {
      id: eventId,
      OR: [
        { status: AchievementEventStatus.PENDING },
        { status: AchievementEventStatus.RETRY_SCHEDULED },
        { status: AchievementEventStatus.PROCESSING, lockedAt: { lte: staleBefore } },
      ],
    },
    data: {
      status: AchievementEventStatus.PROCESSING,
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  if (!claim.count) {
    const current = await prisma.achievementEvent.findUnique({
      where: { id: eventId },
      select: { status: true },
    });
    return { eventId, status: current?.status ?? "MISSING", disposition: "NOT_CLAIMED" };
  }

  try {
    const event = await prisma.achievementEvent.findUniqueOrThrow({ where: { id: eventId } });
    validateTrustedEvent(event);

    let evidenceId: string | null = null;
    let destinationEvaluation: unknown = null;
    if (event.type === AchievementEventType.STAY_COMPLETION_CANDIDATE) {
      const evidence = await materializeBookingCandidateEvidence(event);
      evidenceId = evidence.id;
      const { evaluateDestinationAchievementsForEvidence } = await import(
        "@/services/stayelite-destination-intelligence.service"
      );
      destinationEvaluation = await evaluateDestinationAchievementsForEvidence(evidence.id);
    }

    const { evaluateQualityBehaviorAchievementsForEvent } = await import(
      "@/services/stayelite-quality-behavior.service"
    );
    const qualityBehaviorEvaluation = await evaluateQualityBehaviorAchievementsForEvent({
      userId: event.userId,
      type: event.type,
    });

    // Phase 5 consumes the same durable event envelope, but its evaluator is
    // read-only with respect to tier transitions unless explicit server
    // activation and every governing policy approval are present.
    const { evaluateGuestStayEliteTier } = await import("@/services/stayelite-tier.service");
    const tierEvaluation = event.userId
      ? await evaluateGuestStayEliteTier({
          userId: event.userId,
          sourceType: `ACHIEVEMENT_EVENT:${event.type}`,
          sourceReference: event.sourceEntityId,
          sourceEventId: event.id,
          idempotencyKey: `stayelite-tier:event:${event.id}`,
          persist: true,
        })
      : { evaluated: false, reason: "EVENT_HAS_NO_USER" };

    // Definitions may be stored for administration, but Phase 2 makes no
    // award, projection, tier, notification, or commercial side effect.
    const automaticAwardingEnabled = isAutomaticAchievementAwardingEnabled();
    await prisma.achievementEvent.update({
      where: { id: event.id },
      data: {
        status: AchievementEventStatus.PROCESSED,
        processedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        metadata: {
          ...((event.metadata as Record<string, unknown> | null) ?? {}),
          phase3DestinationEvaluation: destinationEvaluation,
          phase4QualityBehaviorEvaluation: JSON.parse(JSON.stringify(qualityBehaviorEvaluation)),
          phase5TierEvaluation: JSON.parse(JSON.stringify(tierEvaluation)),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      eventId: event.id,
      status: AchievementEventStatus.PROCESSED,
      evidenceId,
      destinationEvaluation,
      qualityBehaviorEvaluation,
      tierEvaluation,
      automaticAwardingEnabled,
      awardIssued: false,
    };
  } catch (error: any) {
    await prisma.achievementEvent.update({
      where: { id: eventId },
      data: {
        status: AchievementEventStatus.RETRY_SCHEDULED,
        lockedAt: null,
        lockedBy: null,
        lastError: error?.message || String(error),
      },
    }).catch(() => undefined);
    throw error;
  }
}
