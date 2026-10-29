import { Prisma } from "@/generated/prisma/client";
import {
  BookingVisitEvidenceStatus,
  ReferralRewardStatus,
  ReviewDirection,
  ReviewStatus,
  StayEliteMembershipStatus,
  StayEliteQualificationStatus,
  StayEliteTierChangeDisposition,
  StayEliteTierChangeType,
  StayEliteTierCode,
  UserStatus,
} from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, isSuperAdmin, PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";
import { enqueueLoyaltyNotification } from "@/services/stayelite-notification.service";

export const STAYELITE_TIER_POLICY_VERSION = "stayelite-tier-v1";

const TIER_ORDER: Record<StayEliteTierCode, number> = {
  [StayEliteTierCode.TRAVELER]: 1,
  [StayEliteTierCode.AMBASSADOR]: 2,
  [StayEliteTierCode.ICON]: 3,
};

export const STAYELITE_TIER_DEFINITIONS = [
  {
    code: StayEliteTierCode.TRAVELER,
    displayName: "Traveler",
    displayOrder: 1,
    qualification: { activeRegisteredGuest: true, qualifyingStays: 1, submittedGuestReviews: 1 },
    benefits: [{ key: "SEASONAL_DEALS", eligible: true, active: false, reason: "Campaign policy is pending." }],
  },
  {
    code: StayEliteTierCode.AMBASSADOR,
    displayName: "Ambassador",
    displayOrder: 2,
    qualification: { qualifyingStays: 15, hostRatings: 10, averageGuestRating: 4.8, qualifiedReferrals: 5 },
    benefits: [
      { key: "TIER_DISCOUNT_PERCENT", value: 5, eligible: true, active: false, reason: "DEC-010" },
      { key: "VIP_PROFILE", eligible: true, active: true },
    ],
  },
  {
    code: StayEliteTierCode.ICON,
    displayName: "Icon",
    displayOrder: 3,
    qualification: { qualifyingStays: 25, hostRatings: 10, averageGuestRating: 4.8, qualifiedReferrals: 10 },
    benefits: [
      { key: "TIER_DISCOUNT_PERCENT", value: 10, eligible: true, active: false, reason: "DEC-010" },
      { key: "VIP_PROFILE", eligible: true, active: true },
      { key: "EXTRA_NIGHT_14_PLUS", eligible: true, active: false, reason: "DEC-011" },
    ],
  },
] as const;

export type TierBookingEvidence = { id: string; qualificationPolicyVersion: string | null };
export type TierReviewEvidence = {
  id: string;
  bookingId: string | null;
  rating: number;
  authorId: string;
  targetUserId: string | null;
  direction: ReviewDirection;
  status: ReviewStatus;
  bookingGuestId: string | null;
  bookingHostId: string | null;
};
export type TierReferralEvidence = {
  id: string;
  referredUserId: string;
  inviterId: string;
  qualifyingBookingId: string;
  bookingGuestId: string | null;
  qualifyingStay: boolean;
};

export type TierEvaluationPolicy = {
  completionApproved?: boolean;
  ratingEligibilityApproved?: boolean;
  referralConversionApproved?: boolean;
  downgradeApproved?: boolean;
};

export type TierEvaluationInput = {
  guestId: string;
  registeredActive: boolean;
  currentTier?: StayEliteTierCode | null;
  bookings: readonly TierBookingEvidence[];
  reviews: readonly TierReviewEvidence[];
  referrals: readonly TierReferralEvidence[];
  policy?: TierEvaluationPolicy;
  now?: Date;
};

type CriterionProgress = { current: number; required: number; met: boolean };
export type TierQualification = {
  guestId: string;
  currentTier: StayEliteTierCode | null;
  evaluatedTier: StayEliteTierCode | null;
  qualificationStatus: StayEliteQualificationStatus;
  completedQualifyingStayCount: number;
  submittedGuestReviewCount: number;
  eligibleReviewCount: number;
  averageGuestRating: number | null;
  qualifyingReferralCount: number;
  progress: Record<string, CriterionProgress | { current: boolean; required: boolean; met: boolean }>;
  tierProgress: Record<StayEliteTierCode, { met: boolean; missingConditions: string[] }>;
  nextTier: StayEliteTierCode | null;
  missingConditions: string[];
  policyBlockers: string[];
  evaluatedAt: string;
  ruleVersion: string;
  proposedTransition: { from: StayEliteTierCode | null; to: StayEliteTierCode; disposition: "PROPOSED" | "BLOCKED" } | null;
  benefits: ReadonlyArray<{ key: string; value?: number; eligible: boolean; active: boolean; reason?: string }>;
  evidence: { bookingIds: string[]; hostRatingIds: string[]; guestReviewIds: string[]; referralConversionIds: string[]; hostIds: string[] };
};

function unique<T extends { id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function policyBlockers(policy: TierEvaluationPolicy): string[] {
  const blockers: string[] = [];
  if (!policy.completionApproved) blockers.push("DEC-001");
  if (!policy.ratingEligibilityApproved) blockers.push("DEC-004");
  if (!policy.referralConversionApproved) blockers.push("DEC-007");
  return blockers;
}

/**
 * Pure qualification adapter shared by event handlers, reconciliation and API
 * projections. Inputs are trusted database evidence only; no client metric is
 * accepted here or by the route layer.
 */
export function evaluateStayEliteTier(input: TierEvaluationInput): TierQualification {
  const now = input.now ?? new Date();
  const policy = input.policy ?? {};
  const bookingIds = new Set(unique(input.bookings).map((booking) => booking.id));
  const hostRatings = unique(input.reviews)
    .filter((review) => review.direction === ReviewDirection.HOST_TO_GUEST
      && review.status === ReviewStatus.PUBLISHED
      && Boolean(review.bookingId)
      && bookingIds.has(review.bookingId!)
      && review.targetUserId === input.guestId
      && review.bookingGuestId === input.guestId
      && review.bookingHostId === review.authorId
      && review.authorId !== input.guestId);
  const hostRatingsByBooking = new Map<string, TierReviewEvidence>();
  for (const review of hostRatings) if (review.bookingId && !hostRatingsByBooking.has(review.bookingId)) hostRatingsByBooking.set(review.bookingId, review);
  const eligibleRatings = [...hostRatingsByBooking.values()];
  const guestReviews = unique(input.reviews)
    .filter((review) => review.direction === ReviewDirection.GUEST_TO_PROPERTY
      && review.status === ReviewStatus.PUBLISHED
      && Boolean(review.bookingId)
      && bookingIds.has(review.bookingId!)
      && review.authorId === input.guestId
      && review.bookingGuestId === input.guestId);
  const guestReviewsByBooking = new Map<string, TierReviewEvidence>();
  for (const review of guestReviews) if (review.bookingId && !guestReviewsByBooking.has(review.bookingId)) guestReviewsByBooking.set(review.bookingId, review);
  const qualifyingReferralsByGuest = new Map<string, TierReferralEvidence>();
  for (const referral of unique(input.referrals)) {
    if (referral.inviterId === input.guestId
      && referral.referredUserId !== input.guestId
      && referral.bookingGuestId === referral.referredUserId
      && referral.qualifyingStay
      && !qualifyingReferralsByGuest.has(referral.referredUserId)) {
      qualifyingReferralsByGuest.set(referral.referredUserId, referral);
    }
  }

  const completedQualifyingStayCount = bookingIds.size;
  const submittedGuestReviewCount = guestReviewsByBooking.size;
  const eligibleReviewCount = eligibleRatings.length;
  const averageGuestRating = eligibleRatings.length
    ? eligibleRatings.reduce((total, review) => total + review.rating, 0) / eligibleRatings.length
    : null;
  const qualifyingReferralCount = qualifyingReferralsByGuest.size;
  const progress = {
    registeredGuest: { current: input.registeredActive, required: true, met: input.registeredActive },
    qualifyingStays: { current: completedQualifyingStayCount, required: 1, met: completedQualifyingStayCount >= 1 },
    submittedGuestReviews: { current: submittedGuestReviewCount, required: 1, met: submittedGuestReviewCount >= 1 },
    hostRatings: { current: eligibleReviewCount, required: 10, met: eligibleReviewCount >= 10 },
    averageGuestRating: { current: averageGuestRating ?? 0, required: 4.8, met: (averageGuestRating ?? 0) >= 4.8 },
    ambassadorReferrals: { current: qualifyingReferralCount, required: 5, met: qualifyingReferralCount >= 5 },
    iconReferrals: { current: qualifyingReferralCount, required: 10, met: qualifyingReferralCount >= 10 },
  };
  const tierProgress = {
    [StayEliteTierCode.TRAVELER]: {
      met: progress.registeredGuest.met && progress.qualifyingStays.met && progress.submittedGuestReviews.met,
      missingConditions: [
        ...(!progress.registeredGuest.met ? ["ACTIVE_REGISTERED_GUEST"] : []),
        ...(!progress.qualifyingStays.met ? ["QUALIFYING_COMPLETED_STAY"] : []),
        ...(!progress.submittedGuestReviews.met ? ["PUBLISHED_GUEST_TO_PROPERTY_REVIEW"] : []),
      ],
    },
    [StayEliteTierCode.AMBASSADOR]: {
      met: completedQualifyingStayCount >= 15 && progress.hostRatings.met && progress.averageGuestRating.met && progress.ambassadorReferrals.met,
      missingConditions: [
        ...(completedQualifyingStayCount < 15 ? ["15_QUALIFYING_COMPLETED_STAYS"] : []),
        ...(!progress.hostRatings.met ? ["10_ELIGIBLE_HOST_TO_GUEST_RATINGS"] : []),
        ...(!progress.averageGuestRating.met ? ["4.8_UNROUNDED_GUEST_RATING"] : []),
        ...(!progress.ambassadorReferrals.met ? ["5_QUALIFYING_CONVERTED_REFERRALS"] : []),
      ],
    },
    [StayEliteTierCode.ICON]: {
      met: completedQualifyingStayCount >= 25 && progress.hostRatings.met && progress.averageGuestRating.met && progress.iconReferrals.met,
      missingConditions: [
        ...(completedQualifyingStayCount < 25 ? ["25_QUALIFYING_COMPLETED_STAYS"] : []),
        ...(!progress.hostRatings.met ? ["10_ELIGIBLE_HOST_TO_GUEST_RATINGS"] : []),
        ...(!progress.averageGuestRating.met ? ["4.8_UNROUNDED_GUEST_RATING"] : []),
        ...(!progress.iconReferrals.met ? ["10_QUALIFYING_CONVERTED_REFERRALS"] : []),
      ],
    },
  };
  const evaluatedTier = tierProgress[StayEliteTierCode.ICON].met ? StayEliteTierCode.ICON
    : tierProgress[StayEliteTierCode.AMBASSADOR].met ? StayEliteTierCode.AMBASSADOR
      : tierProgress[StayEliteTierCode.TRAVELER].met ? StayEliteTierCode.TRAVELER : null;
  const blockers = policyBlockers(policy);
  const qualificationStatus = evaluatedTier
    ? blockers.length ? StayEliteQualificationStatus.POLICY_BLOCKED : StayEliteQualificationStatus.QUALIFIED
    : completedQualifyingStayCount || submittedGuestReviewCount || eligibleReviewCount || qualifyingReferralCount
      ? StayEliteQualificationStatus.IN_PROGRESS : StayEliteQualificationStatus.NOT_ELIGIBLE;
  const currentTier = input.currentTier ?? null;
  const proposedTransition = evaluatedTier && (!currentTier || TIER_ORDER[evaluatedTier] > TIER_ORDER[currentTier])
    ? { from: currentTier, to: evaluatedTier, disposition: (blockers.length ? "BLOCKED" : "PROPOSED") as "PROPOSED" | "BLOCKED" }
    : null;
  const nextTier = evaluatedTier === StayEliteTierCode.ICON ? null
    : evaluatedTier === StayEliteTierCode.AMBASSADOR ? StayEliteTierCode.ICON
      : evaluatedTier === StayEliteTierCode.TRAVELER ? StayEliteTierCode.AMBASSADOR
        : StayEliteTierCode.TRAVELER;
  const target = evaluatedTier ?? currentTier;
  const definition = target ? STAYELITE_TIER_DEFINITIONS.find((item) => item.code === target) : null;
  const missingConditions = nextTier ? tierProgress[nextTier].missingConditions : [];

  return {
    guestId: input.guestId,
    currentTier,
    evaluatedTier,
    qualificationStatus,
    completedQualifyingStayCount,
    submittedGuestReviewCount,
    eligibleReviewCount,
    averageGuestRating,
    qualifyingReferralCount,
    progress,
    tierProgress,
    nextTier,
    missingConditions,
    policyBlockers: blockers,
    evaluatedAt: now.toISOString(),
    ruleVersion: STAYELITE_TIER_POLICY_VERSION,
    proposedTransition,
    benefits: definition?.benefits ?? [],
    evidence: {
      bookingIds: [...bookingIds],
      hostRatingIds: eligibleRatings.map((review) => review.id),
      guestReviewIds: [...guestReviewsByBooking.values()].map((review) => review.id),
      referralConversionIds: [...qualifyingReferralsByGuest.values()].map((referral) => referral.id),
      hostIds: [...new Set(eligibleRatings.map((review) => review.authorId))],
    },
  };
}

async function loadTrustedTierInput(userId: string, currentTier?: StayEliteTierCode | null): Promise<TierEvaluationInput> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user) throw AppError.notFound("Guest not found");
  const bookings = await prisma.bookingVisitEvidence.findMany({
    where: { userId, status: BookingVisitEvidenceStatus.QUALIFIED },
    select: { bookingId: true, qualificationPolicyVersion: true },
  });
  const bookingIds = bookings.map((booking) => booking.bookingId);
  const [reviews, referrals] = await Promise.all([
    bookingIds.length ? prisma.review.findMany({
      where: { bookingId: { in: bookingIds }, OR: [{ targetUserId: userId }, { authorId: userId }] },
      select: {
        id: true, bookingId: true, rating: true, authorId: true, targetUserId: true, direction: true, status: true,
        booking: { select: { userId: true, listing: { select: { hostId: true } } } },
      },
    }) : Promise.resolve([]),
    prisma.referralReward.findMany({
      where: { inviterId: userId, status: ReferralRewardStatus.APPROVED },
      select: {
        id: true, referredUserId: true, inviterId: true, qualifyingBookingId: true,
        qualifyingBooking: { select: { userId: true, visitEvidence: { select: { status: true } } } },
      },
    }),
  ]);
  return {
    guestId: userId,
    registeredActive: user.status === UserStatus.ACTIVE,
    currentTier,
    bookings: bookings.map((booking) => ({ id: booking.bookingId, qualificationPolicyVersion: booking.qualificationPolicyVersion })),
    reviews: reviews.map((review) => ({
      id: review.id, bookingId: review.bookingId, rating: review.rating, authorId: review.authorId, targetUserId: review.targetUserId,
      direction: review.direction, status: review.status, bookingGuestId: review.booking?.userId ?? null,
      bookingHostId: review.booking?.listing.hostId ?? null,
    })),
    referrals: referrals.map((referral) => ({
      id: referral.id, referredUserId: referral.referredUserId, inviterId: referral.inviterId,
      qualifyingBookingId: referral.qualifyingBookingId, bookingGuestId: referral.qualifyingBooking.userId,
      qualifyingStay: referral.qualifyingBooking.visitEvidence?.status === BookingVisitEvidenceStatus.QUALIFIED,
    })),
  };
}

export function isTierPromotionEnabled(): boolean {
  return process.env.STAYELITE_TIER_PROMOTIONS_ENABLED === "true";
}

export async function evaluateGuestStayEliteTier(options: {
  userId: string;
  sourceType: string;
  sourceReference?: string | null;
  sourceEventId?: string | null;
  idempotencyKey?: string;
  persist?: boolean;
}): Promise<TierQualification> {
  const membership = await prisma.stayEliteMembership.findUnique({ where: { userId: options.userId }, select: { currentTier: true } });
  const result = evaluateStayEliteTier(await loadTrustedTierInput(options.userId, membership?.currentTier));
  if (options.persist) {
    await persistTierEvaluation(options, result, membership?.currentTier ?? null);
    // Only a committed, enabled transition may reach the downstream queue.
    // The queue key is deterministic, so evaluation replay cannot notify twice.
    if (result.proposedTransition?.disposition === "PROPOSED" && isTierPromotionEnabled()) {
      const sourceId = options.idempotencyKey ?? `stayelite-tier:${options.userId}:${options.sourceType}:${options.sourceReference ?? result.evaluatedAt}`;
      await enqueueLoyaltyNotification({ event: "TIER_CHANGED", userId: options.userId, sourceId, sourceType: "STAYELITE_TIER_EVALUATION", label: result.proposedTransition.to, occurredAt: new Date(result.evaluatedAt), metadata: { from: result.proposedTransition.from, to: result.proposedTransition.to, ruleVersion: result.ruleVersion } });
    }
  }
  return result;
}

async function persistTierEvaluation(
  options: Parameters<typeof evaluateGuestStayEliteTier>[0],
  result: TierQualification,
  currentTier: StayEliteTierCode | null,
) {
  const idempotencyKey = options.idempotencyKey ?? `stayelite-tier:${options.userId}:${options.sourceType}:${options.sourceReference ?? result.evaluatedAt}`;
  const existing = await prisma.stayEliteTierEvaluation.findUnique({ where: { idempotencyKey }, select: { id: true } });
  if (existing) return existing;
  const serializedResult = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
  const evidenceSnapshot = JSON.parse(JSON.stringify(result.evidence)) as Prisma.InputJsonValue;
  try {
    return await prisma.$transaction(async (tx) => {
      const membership = await tx.stayEliteMembership.upsert({
        where: { userId: options.userId },
        create: {
          userId: options.userId,
          policyVersion: STAYELITE_TIER_POLICY_VERSION,
          qualificationStatus: result.qualificationStatus,
          lastEvaluatedAt: new Date(result.evaluatedAt),
          lastQualifiedAt: result.qualificationStatus === StayEliteQualificationStatus.QUALIFIED ? new Date(result.evaluatedAt) : null,
          lastEvaluationReason: options.sourceType,
          progressSnapshot: serializedResult,
        },
        update: {
          qualificationStatus: result.qualificationStatus,
          policyVersion: STAYELITE_TIER_POLICY_VERSION,
          lastEvaluatedAt: new Date(result.evaluatedAt),
          ...(result.qualificationStatus === StayEliteQualificationStatus.QUALIFIED ? { lastQualifiedAt: new Date(result.evaluatedAt) } : {}),
          lastEvaluationReason: options.sourceType,
          progressSnapshot: serializedResult,
        },
      });
      const evaluation = await tx.stayEliteTierEvaluation.create({
        data: {
          membershipId: membership.id, userId: options.userId, sourceEventId: options.sourceEventId ?? null,
          sourceType: options.sourceType, sourceReference: options.sourceReference ?? null, idempotencyKey,
          policyVersion: STAYELITE_TIER_POLICY_VERSION, qualificationStatus: result.qualificationStatus,
          evaluatedTier: result.evaluatedTier, proposedTier: result.proposedTransition?.to ?? null,
          completedStayCount: result.completedQualifyingStayCount, eligibleReviewCount: result.eligibleReviewCount,
          averageGuestRating: result.averageGuestRating, qualifyingReferralCount: result.qualifyingReferralCount,
          policyBlockers: result.policyBlockers, missingConditions: result.missingConditions,
          evidenceSnapshot, resultSnapshot: serializedResult, evaluatedAt: new Date(result.evaluatedAt),
        },
      });
      await tx.stayEliteTierHistory.createMany({
        data: [{
          membershipId: membership.id, userId: options.userId, evaluationId: evaluation.id,
          previousTier: null, newTier: currentTier, changeType: StayEliteTierChangeType.INITIAL,
          disposition: StayEliteTierChangeDisposition.APPLIED, policyVersion: STAYELITE_TIER_POLICY_VERSION,
          sourceEventId: options.sourceEventId ?? null, idempotencyKey: `stayelite-tier:initial:${options.userId}`,
          reason: "Membership projection initialized by trusted evaluation.", snapshot: serializedResult,
        }],
        skipDuplicates: true,
      });
      if (result.proposedTransition) {
        const canApply = isTierPromotionEnabled() && result.proposedTransition.disposition === "PROPOSED";
        await tx.stayEliteTierHistory.create({
          data: {
            membershipId: membership.id, userId: options.userId, evaluationId: evaluation.id,
            previousTier: currentTier, newTier: result.proposedTransition.to,
            changeType: StayEliteTierChangeType.PROMOTION,
            disposition: canApply ? StayEliteTierChangeDisposition.APPLIED : StayEliteTierChangeDisposition.BLOCKED,
            policyVersion: STAYELITE_TIER_POLICY_VERSION, sourceEventId: options.sourceEventId ?? null,
            idempotencyKey: `stayelite-tier:transition:${idempotencyKey}`,
            reason: canApply ? "Trusted eligibility promotion." : "Promotion activation or required policy approval is disabled.",
            snapshot: serializedResult,
          },
        });
        if (canApply) {
          await tx.stayEliteMembership.update({
            where: { id: membership.id },
            data: { currentTier: result.proposedTransition.to, status: StayEliteMembershipStatus.ACTIVE },
          });
        }
      }
      return evaluation;
    });
  } catch (error: any) {
    if (error?.code === "P2002") return prisma.stayEliteTierEvaluation.findUnique({ where: { idempotencyKey } });
    throw error;
  }
}

export async function getStayEliteTierProjection(userId: string) {
  const membership = await prisma.stayEliteMembership.findUnique({
    where: { userId },
    select: { currentTier: true, status: true, qualificationStatus: true, lastEvaluatedAt: true, progressSnapshot: true, tierPubliclyVisible: true },
  });
  return membership ? { ...membership, progressSnapshot: membership.progressSnapshot } : {
    currentTier: null, status: StayEliteMembershipStatus.PENDING,
    qualificationStatus: StayEliteQualificationStatus.NOT_ELIGIBLE, lastEvaluatedAt: null,
    progressSnapshot: null, tierPubliclyVisible: false,
  };
}

/**
 * Internal-only correction primitive for a future RBAC-protected admin route.
 * It requires an identified actor, a non-empty reason and an idempotency key;
 * callers must enforce the appropriate permission before invoking it.
 */
export async function applyStayEliteTierCorrection(input: {
  userId: string;
  newTier: StayEliteTierCode | null;
  actor: AuthUser;
  reason: string;
  idempotencyKey: string;
}) {
  if (!input.actor.id || !input.reason.trim() || !input.idempotencyKey.trim()) {
    throw AppError.validation("An authorized actor, reason, and idempotency key are required for a tier correction.");
  }
  if (!isSuperAdmin(input.actor) && !hasPermission(input.actor, PERMISSIONS.GUESTS_EDIT)) {
    throw AppError.forbidden("Missing required permission: guests.edit");
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw AppError.notFound("Guest not found");
  const existing = await prisma.stayEliteTierHistory.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;
  const history = await prisma.$transaction(async (tx) => {
    const prior = await tx.stayEliteMembership.findUnique({
      where: { userId: input.userId },
      select: { currentTier: true },
    });
    const membership = await tx.stayEliteMembership.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId, currentTier: input.newTier,
        status: input.newTier ? StayEliteMembershipStatus.ACTIVE : StayEliteMembershipStatus.PENDING,
        policyVersion: STAYELITE_TIER_POLICY_VERSION,
        qualificationStatus: StayEliteQualificationStatus.NOT_ELIGIBLE,
        lastEvaluationReason: "ADMIN_CORRECTION",
      },
      update: {
        currentTier: input.newTier,
        status: input.newTier ? StayEliteMembershipStatus.ACTIVE : StayEliteMembershipStatus.PENDING,
        lastEvaluationReason: "ADMIN_CORRECTION",
      },
    });
    return tx.stayEliteTierHistory.create({
      data: {
        membershipId: membership.id, userId: input.userId, previousTier: prior?.currentTier ?? null,
        newTier: input.newTier, changeType: StayEliteTierChangeType.ADMIN_CORRECTION,
        disposition: StayEliteTierChangeDisposition.APPLIED, policyVersion: STAYELITE_TIER_POLICY_VERSION,
        authorizedById: input.actor.id, idempotencyKey: input.idempotencyKey, reason: input.reason.trim(),
        snapshot: membership.progressSnapshot ?? { source: "ADMIN_CORRECTION", financialBenefitsActivated: false },
      },
    });
  });
  await auditService.record({
    actorId: input.actor.id, actorEmail: input.actor.email ?? null,
    action: "STAYELITE_TIER_CORRECTED", resourceType: "STAYELITE_MEMBERSHIP", resourceId: history.membershipId,
    description: "Applied an authorized StayElite tier correction.",
    metadata: { guestId: input.userId, previousTier: history.previousTier, newTier: history.newTier, reason: input.reason.trim() },
  });
  await enqueueLoyaltyNotification({ event: "TIER_CORRECTED", userId: input.userId, sourceId: history.id, sourceType: "STAYELITE_TIER_HISTORY", label: input.newTier, occurredAt: history.occurredAt, metadata: { previousTier: history.previousTier, newTier: history.newTier } });
  return history;
}

export async function reconcileStayEliteTiers(options: { userId?: string; cursor?: string; limit?: number; persist?: boolean } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const users = options.userId ? [{ id: options.userId }] : await prisma.user.findMany({
    where: { bookingVisitEvidence: { some: {} }, ...(options.cursor ? { id: { gt: options.cursor } } : {}) },
    select: { id: true }, orderBy: { id: "asc" }, take: limit,
  });
  const persist = options.persist === true && process.env.STAYELITE_TIER_RECONCILIATION_PERSIST_ENABLED === "true";
  const reports = await Promise.all(users.map(async (user) => ({
    userId: user.id,
    result: await evaluateGuestStayEliteTier({
      userId: user.id, sourceType: "RECONCILIATION", sourceReference: `cursor:${options.cursor ?? "start"}`,
      idempotencyKey: `stayelite-tier:reconciliation:${user.id}:${options.cursor ?? "start"}`,
      persist,
    }),
  })));
  return {
    dryRun: !persist, persisted: persist, processedUsers: reports.length, reports,
    nextCursor: !options.userId && users.length === limit ? users.at(-1)?.id ?? null : null,
    promotionsApplied: 0, pointsIssued: 0, discountsApplied: 0, vouchersIssued: 0,
  };
}

export const stayEliteTierService = {
  evaluateGuestStayEliteTier,
  getStayEliteTierProjection,
  applyStayEliteTierCorrection,
  reconcileStayEliteTiers,
};
