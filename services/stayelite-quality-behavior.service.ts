import {
  AchievementEventType,
  BookingVisitEvidenceStatus,
  CountryLanguageKind,
  ReviewDirection,
  ReviewStatus,
  TaxonomyRecordStatus,
  TravelAchievementCategory,
  TravelAchievementDefinitionStatus,
  TravelAchievementStatus,
} from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { generateDestinationSlug } from "@/services/travel-destination.service";

export const QUALITY_BEHAVIOR_RULE_VERSION = 1;

export type QualityBehaviorDefinition = {
  key: string;
  name: string;
  description: string;
  category: TravelAchievementCategory;
  threshold: number;
  eventTypes: readonly AchievementEventType[];
  blockers: readonly string[];
  inactiveBenefit?: string;
};

export const QUALITY_BEHAVIOR_DEFINITIONS: readonly QualityBehaviorDefinition[] = [
  { key: "BADGE_ZERO_CANCEL_PRO_V1", name: "Zero-Cancel Pro", description: "Ten consecutive bookings without a policy-defined cancellation.", category: TravelAchievementCategory.STAYS, threshold: 10, eventTypes: [AchievementEventType.BOOKING_CANCELLED, AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-003"], inactiveBenefit: "+300 points (not issued)" },
  { key: "BADGE_FIVE_STAR_STREAK_V1", name: "5-Star Streak", description: "Five consecutive published five-star host-to-guest ratings.", category: TravelAchievementCategory.STAYS, threshold: 5, eventTypes: [AchievementEventType.HOST_RATING_PUBLISHED, AchievementEventType.REVIEW_PUBLISHED], blockers: ["DEC-004", "DEC-009"], inactiveBenefit: "10% next-tier boost (not issued)" },
  { key: "BADGE_SUPER_REVIEWER_V1", name: "Super Reviewer", description: "Fifteen policy-qualified written guest reviews.", category: TravelAchievementCategory.STAYS, threshold: 15, eventTypes: [AchievementEventType.REVIEW_PUBLISHED], blockers: ["DEC-005"], inactiveBenefit: "Verified guest eligibility only (not identity verification)" },
  { key: "BADGE_CITY_COLLECTOR_V1", name: "City Collector", description: "Ten distinct canonical verified cities.", category: TravelAchievementCategory.CITIES, threshold: 10, eventTypes: [AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: [] , inactiveBenefit: "Upgrade option (not issued)" },
  { key: "BADGE_LOYAL_NOMAD_V1", name: "Loyal Nomad", description: "Three consecutive completed stays longer than fourteen nights.", category: TravelAchievementCategory.STAYS, threshold: 3, eventTypes: [AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-006"], inactiveBenefit: "Late checkout option (not issued)" },
  { key: "STICKER_EARLY_BIRD_V1", name: "Early Bird", description: "A booking confirmed at least thirty days before check-in.", category: TravelAchievementCategory.STAYS, threshold: 1, eventTypes: [AchievementEventType.BOOKING_CONFIRMED, AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-001", "DEC-002"] },
  { key: "STICKER_LAST_MINUTE_LUCK_V1", name: "Last Minute Luck", description: "A booking confirmed within twelve hours before check-in.", category: TravelAchievementCategory.STAYS, threshold: 1, eventTypes: [AchievementEventType.BOOKING_CONFIRMED, AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-001", "DEC-002"] },
  { key: "STICKER_LOYAL_WANDERER_V1", name: "Loyal Wanderer", description: "Three qualifying stays at the same listing.", category: TravelAchievementCategory.STAYS, threshold: 3, eventTypes: [AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-001"] },
  { key: "STICKER_SEASON_HOPPER_V1", name: "Season Hopper", description: "Qualifying stays across all four approved seasons.", category: TravelAchievementCategory.STAYS, threshold: 4, eventTypes: [AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-013"] },
  { key: "STICKER_GROUP_PACK_V1", name: "Group Pack", description: "A qualifying booking for at least four guests.", category: TravelAchievementCategory.STAYS, threshold: 1, eventTypes: [AchievementEventType.BOOKING_CONFIRMED, AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-001"] },
  { key: "STICKER_PERFECT_GUEST_V1", name: "Perfect Guest", description: "Ten five-star ratings from distinct hosts.", category: TravelAchievementCategory.STAYS, threshold: 10, eventTypes: [AchievementEventType.HOST_RATING_PUBLISHED, AchievementEventType.REVIEW_PUBLISHED], blockers: ["DEC-004"] },
  { key: "STICKER_TEN_STAY_VETERAN_V1", name: "10-Stay Veteran", description: "Ten qualifying completed stays.", category: TravelAchievementCategory.STAYS, threshold: 10, eventTypes: [AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-001"] },
  { key: "STICKER_LANGUAGE_LEAPER_V1", name: "Language Leaper", description: "Three countries with different policy-selected native languages.", category: TravelAchievementCategory.COUNTRIES, threshold: 3, eventTypes: [AchievementEventType.STAY_COMPLETION_CANDIDATE, AchievementEventType.BOOKING_CANCELLED, AchievementEventType.BOOKING_REFUNDED], blockers: ["DEC-015"] },
];

export type BookingRuleEvidence = {
  id: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  confirmedAt?: Date | null;
  guests: number;
  evidenceStatus: BookingVisitEvidenceStatus;
  bookingStatus: "CONFIRMED" | "CANCELLED" | "PENDING";
  countryCode?: string | null;
  cityName?: string | null;
};

export type ReviewRuleEvidence = {
  id: string;
  bookingId?: string | null;
  authorId: string;
  targetUserId?: string | null;
  hostId?: string | null;
  direction: ReviewDirection;
  status: ReviewStatus;
  rating: number;
  comment: string;
  publishedAt?: Date | null;
  updatedAt: Date;
};

export type LanguageRuleEvidence = {
  countryCode: string;
  languageCode: string;
  kind: CountryLanguageKind;
  datasetVersion: string;
};

export type SeasonPolicy = { hemisphere: "NORTH" | "SOUTH"; calendar: "CALENDAR_YEAR" | "ROLLING_YEAR" };
export type QualityBehaviorPolicy = {
  completionApproved?: boolean;
  cancellationStreakPolicy?: "ANY_CANCELLED_BOOKING_BREAKS";
  ratingEligibilityApproved?: boolean;
  highQualityReviewApproved?: boolean;
  sequenceApproved?: boolean;
  seasonPolicy?: SeasonPolicy;
  languageSelectionApproved?: boolean;
  highQualityReviewPredicate?: (review: ReviewRuleEvidence) => boolean;
};

export type AchievementEvaluationAuthorization = "CALCULABLE" | "BLOCKED_BY_POLICY" | "MISSING_AUTHORITATIVE_EVIDENCE";
export type QualityBehaviorEvaluation = {
  key: string;
  ruleVersion: number;
  progress: number;
  threshold: number;
  status: TravelAchievementStatus;
  authorization: AchievementEvaluationAuthorization;
  definitiveEligibility: boolean;
  awardAuthorized: false;
  evidenceIds: string[];
  missingRequirements: string[];
  policyBlockers: string[];
  evaluatedAt: Date;
  inactiveBenefit?: string;
};

function uniqueById<T extends { id: string }>(items: readonly T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function orderBookingEvidence(items: readonly BookingRuleEvidence[]) {
  return uniqueById(items).sort((left, right) =>
    left.endDate.getTime() - right.endDate.getTime() || left.startDate.getTime() - right.startDate.getTime() || left.id.localeCompare(right.id),
  );
}

export function orderReviewEvidence(items: readonly ReviewRuleEvidence[]) {
  return uniqueById(items).sort((left, right) =>
    (left.publishedAt ?? left.updatedAt).getTime() - (right.publishedAt ?? right.updatedAt).getTime() || left.id.localeCompare(right.id),
  );
}

function qualifyingBookings(bookings: readonly BookingRuleEvidence[]) {
  return orderBookingEvidence(bookings).filter((booking) => booking.evidenceStatus === BookingVisitEvidenceStatus.QUALIFIED);
}

function trailingCount<T>(items: readonly T[], predicate: (item: T) => boolean) {
  let count = 0;
  for (const item of [...items].reverse()) {
    if (!predicate(item)) break;
    count += 1;
  }
  return count;
}

export function stayNights(booking: Pick<BookingRuleEvidence, "startDate" | "endDate">) {
  return Math.max(0, Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / 86_400_000));
}

export function canonicalCityIdentity(booking: Pick<BookingRuleEvidence, "countryCode" | "cityName">) {
  if (!booking.countryCode || !booking.cityName) return null;
  return generateDestinationSlug(booking.countryCode, booking.cityName);
}

export function leadTimeHours(booking: Pick<BookingRuleEvidence, "confirmedAt" | "startDate">) {
  if (!booking.confirmedAt) return null;
  return (booking.startDate.getTime() - booking.confirmedAt.getTime()) / 3_600_000;
}

export function seasonForDate(date: Date, hemisphere: SeasonPolicy["hemisphere"]) {
  const month = date.getUTCMonth() + 1;
  const north = month === 12 || month <= 2 ? "WINTER" : month <= 5 ? "SPRING" : month <= 8 ? "SUMMER" : "AUTUMN";
  if (hemisphere === "NORTH") return north;
  return north === "WINTER" ? "SUMMER" : north === "SPRING" ? "AUTUMN" : north === "SUMMER" ? "WINTER" : "SPRING";
}

function evaluation(definition: QualityBehaviorDefinition, progress: number, evidenceIds: string[], now: Date, options: { blockers?: string[]; missing?: string[]; eligibility?: boolean } = {}): QualityBehaviorEvaluation {
  const blockers = options.blockers ?? [];
  const missing = options.missing ?? [];
  const capped = Math.min(Math.max(0, progress), definition.threshold);
  const canAuthorize = blockers.length === 0 && missing.length === 0;
  return {
    key: definition.key,
    ruleVersion: QUALITY_BEHAVIOR_RULE_VERSION,
    progress: capped,
    threshold: definition.threshold,
    status: capped === 0 ? TravelAchievementStatus.LOCKED : capped >= definition.threshold && canAuthorize && options.eligibility !== false ? TravelAchievementStatus.ELIGIBLE : TravelAchievementStatus.IN_PROGRESS,
    authorization: blockers.length ? "BLOCKED_BY_POLICY" : missing.length ? "MISSING_AUTHORITATIVE_EVIDENCE" : "CALCULABLE",
    definitiveEligibility: canAuthorize && capped >= definition.threshold && options.eligibility !== false,
    awardAuthorized: false,
    evidenceIds,
    missingRequirements: missing,
    policyBlockers: blockers,
    evaluatedAt: now,
    inactiveBenefit: definition.inactiveBenefit,
  };
}

export function evaluateQualityBehaviorAchievements(input: {
  bookings: readonly BookingRuleEvidence[];
  reviews: readonly ReviewRuleEvidence[];
  languages: readonly LanguageRuleEvidence[];
  policy?: QualityBehaviorPolicy;
  now?: Date;
}): QualityBehaviorEvaluation[] {
  const policy = input.policy ?? {};
  const now = input.now ?? new Date();
  const bookings = orderBookingEvidence(input.bookings);
  const completed = qualifyingBookings(bookings);
  const bookingCandidates = bookings.filter((booking) =>
    booking.bookingStatus === "CONFIRMED" && booking.evidenceStatus !== BookingVisitEvidenceStatus.INVALIDATED,
  );
  const qualifyingBookingIds = new Set(completed.map((booking) => booking.id));
  const hostRatings = orderReviewEvidence(input.reviews).filter((review) => review.direction === ReviewDirection.HOST_TO_GUEST && review.status === ReviewStatus.PUBLISHED && Boolean(review.bookingId) && qualifyingBookingIds.has(review.bookingId!));
  const guestReviews = orderReviewEvidence(input.reviews).filter((review) => review.direction === ReviewDirection.GUEST_TO_PROPERTY && review.status === ReviewStatus.PUBLISHED && Boolean(review.bookingId) && qualifyingBookingIds.has(review.bookingId!) && review.comment.trim().length > 0);
  const definition = (key: string) => QUALITY_BEHAVIOR_DEFINITIONS.find((item) => item.key === key)!;
  const completionBlocker = policy.completionApproved ? [] : ["DEC-001"];

  const zeroCancelable = bookings.filter((booking) => booking.bookingStatus !== "PENDING");
  const zeroStreak = trailingCount(zeroCancelable, (booking) => booking.bookingStatus !== "CANCELLED" && booking.evidenceStatus === BookingVisitEvidenceStatus.QUALIFIED);
  const fiveStarStreak = trailingCount(hostRatings, (review) => review.rating === 5);
  const distinctCities = new Map(completed.map((booking) => [canonicalCityIdentity(booking), booking]));
  distinctCities.delete(null);
  const longStayStreak = trailingCount(completed, (booking) => stayNights(booking) > 14);
  const earlyBookings = bookingCandidates.filter((booking) => {
    const hours = leadTimeHours(booking);
    return hours !== null && hours >= 30 * 24;
  });
  const lastMinuteBookings = bookingCandidates.filter((booking) => {
    const hours = leadTimeHours(booking);
    return hours !== null && hours >= 0 && hours <= 12;
  });
  const byListing = new Map<string, BookingRuleEvidence[]>();
  for (const booking of completed) byListing.set(booking.listingId, [...(byListing.get(booking.listingId) ?? []), booking]);
  const strongestListing = [...byListing.values()].sort((a, b) => b.length - a.length || a[0]!.listingId.localeCompare(b[0]!.listingId))[0] ?? [];
  const seasonSet = policy.seasonPolicy ? new Set(completed.map((booking) => seasonForDate(booking.startDate, policy.seasonPolicy!.hemisphere))) : new Set<string>();
  const groupBookings = bookingCandidates.filter((booking) => booking.guests >= 4);
  const distinctHosts = new Map<string, ReviewRuleEvidence>();
  for (const review of hostRatings) if (review.rating === 5 && review.hostId && review.hostId !== review.targetUserId) distinctHosts.set(review.hostId, review);
  const languageByCountry = new Map<string, string>();
  for (const mapping of input.languages) if (mapping.kind === CountryLanguageKind.PRIMARY_NATIVE && !languageByCountry.has(mapping.countryCode)) languageByCountry.set(mapping.countryCode, mapping.languageCode);
  const completedCountries = [...new Set(completed.map((booking) => booking.countryCode).filter((code): code is string => Boolean(code)))];
  const distinctLanguageCountries = completedCountries.filter((countryCode) => languageByCountry.has(countryCode));
  const languageCodes = new Set(distinctLanguageCountries.map((countryCode) => languageByCountry.get(countryCode)!));

  return [
    evaluation(definition("BADGE_ZERO_CANCEL_PRO_V1"), zeroStreak, zeroCancelable.slice(-zeroStreak).map((item) => item.id), now, { blockers: policy.cancellationStreakPolicy === "ANY_CANCELLED_BOOKING_BREAKS" ? completionBlocker : ["DEC-003"], missing: zeroCancelable.length ? [] : ["BOOKING_SEQUENCE"] }),
    evaluation(definition("BADGE_FIVE_STAR_STREAK_V1"), fiveStarStreak, hostRatings.slice(-fiveStarStreak).map((item) => item.id), now, { blockers: policy.ratingEligibilityApproved ? [] : ["DEC-004"], missing: hostRatings.length ? [] : ["PUBLISHED_HOST_RATINGS"] }),
    evaluation(definition("BADGE_SUPER_REVIEWER_V1"), guestReviews.filter((review) => policy.highQualityReviewPredicate ? policy.highQualityReviewPredicate(review) : true).length, guestReviews.map((item) => item.id), now, { blockers: policy.highQualityReviewApproved ? [] : ["DEC-005"], missing: guestReviews.length ? [] : ["PUBLISHED_WRITTEN_GUEST_REVIEWS"] }),
    evaluation(definition("BADGE_CITY_COLLECTOR_V1"), distinctCities.size, [...distinctCities.values()].map((item) => item.id), now, { blockers: completionBlocker, missing: completed.some((booking) => !canonicalCityIdentity(booking)) ? ["CANONICAL_CITY_EVIDENCE"] : [] }),
    evaluation(definition("BADGE_LOYAL_NOMAD_V1"), longStayStreak, completed.slice(-longStayStreak).map((item) => item.id), now, { blockers: policy.sequenceApproved ? completionBlocker : ["DEC-006"], missing: completed.length ? [] : ["QUALIFYING_COMPLETED_STAYS"] }),
    evaluation(definition("STICKER_EARLY_BIRD_V1"), earlyBookings.length, earlyBookings.map((item) => item.id), now, { blockers: completionBlocker, missing: earlyBookings.some((booking) => !booking.confirmedAt || booking.evidenceStatus !== BookingVisitEvidenceStatus.QUALIFIED) ? ["AUTHORITATIVE_CONFIRMATION_TIMESTAMP_PROPERTY_TIMEZONE_AND_COMPLETION_EVIDENCE"] : [] }),
    evaluation(definition("STICKER_LAST_MINUTE_LUCK_V1"), lastMinuteBookings.length, lastMinuteBookings.map((item) => item.id), now, { blockers: completionBlocker, missing: lastMinuteBookings.some((booking) => !booking.confirmedAt || booking.evidenceStatus !== BookingVisitEvidenceStatus.QUALIFIED) ? ["AUTHORITATIVE_CONFIRMATION_TIMESTAMP_PROPERTY_TIMEZONE_AND_COMPLETION_EVIDENCE"] : [] }),
    evaluation(definition("STICKER_LOYAL_WANDERER_V1"), strongestListing.length, strongestListing.map((item) => item.id), now, { blockers: completionBlocker, missing: completed.length ? [] : ["QUALIFYING_COMPLETED_STAYS"] }),
    evaluation(definition("STICKER_SEASON_HOPPER_V1"), seasonSet.size, completed.map((item) => item.id), now, { blockers: policy.seasonPolicy ? completionBlocker : ["DEC-013"], missing: policy.seasonPolicy ? [] : ["APPROVED_SEASON_REGION_AND_TIMEZONE_POLICY"] }),
    evaluation(definition("STICKER_GROUP_PACK_V1"), groupBookings.length, groupBookings.map((item) => item.id), now, { blockers: completionBlocker, missing: groupBookings.some((booking) => booking.evidenceStatus !== BookingVisitEvidenceStatus.QUALIFIED) ? ["QUALIFYING_COMPLETED_STAY_EVIDENCE"] : [] }),
    evaluation(definition("STICKER_PERFECT_GUEST_V1"), distinctHosts.size, [...distinctHosts.values()].map((item) => item.id), now, { blockers: policy.ratingEligibilityApproved ? [] : ["DEC-004"], missing: hostRatings.length ? [] : ["PUBLISHED_HOST_RATINGS"] }),
    evaluation(definition("STICKER_TEN_STAY_VETERAN_V1"), completed.length, completed.map((item) => item.id), now, { blockers: completionBlocker, missing: completed.length ? [] : ["QUALIFYING_COMPLETED_STAYS"] }),
    evaluation(definition("STICKER_LANGUAGE_LEAPER_V1"), languageCodes.size, completed.filter((booking) => booking.countryCode && distinctLanguageCountries.includes(booking.countryCode)).map((item) => item.id), now, { blockers: policy.languageSelectionApproved ? completionBlocker : ["DEC-015"], missing: languageCodes.size < definition("STICKER_LANGUAGE_LEAPER_V1").threshold && completedCountries.some((countryCode) => !languageByCountry.has(countryCode)) ? ["PRIMARY_NATIVE_LANGUAGE_MAPPING"] : [] }),
  ];
}

export async function evaluateQualityBehaviorAchievementsForUser(userId: string, options: { policy?: QualityBehaviorPolicy; now?: Date } = {}) {
  if (!userId) throw AppError.badRequest("userId is required.");
  const [bookings, confirmations, reviews] = await Promise.all([
    prisma.booking.findMany({
      where: { userId },
      include: { visitEvidence: true },
    }),
    prisma.achievementEvent.findMany({
      where: { userId, type: AchievementEventType.BOOKING_CONFIRMED, bookingId: { not: null } },
      select: { bookingId: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.review.findMany({
      where: { OR: [{ authorId: userId }, { targetUserId: userId }] },
      include: { booking: { select: { userId: true, listing: { select: { hostId: true } } } } },
    }),
  ]);
  const countryCodes = bookings.map((booking) => booking.visitEvidence?.countryCode).filter((code): code is string => Boolean(code));
  const languages = countryCodes.length ? await prisma.countryLanguageMapping.findMany({
    where: { countryCode: { in: countryCodes }, status: TaxonomyRecordStatus.ACTIVE, kind: CountryLanguageKind.PRIMARY_NATIVE },
    select: { countryCode: true, languageCode: true, kind: true, datasetVersion: true },
  }) : [];
  const confirmedAt = new Map<string, Date>();
  for (const confirmation of confirmations) if (confirmation.bookingId && !confirmedAt.has(confirmation.bookingId)) confirmedAt.set(confirmation.bookingId, confirmation.occurredAt);
  return evaluateQualityBehaviorAchievements({
    bookings: bookings.map((booking) => ({
      id: booking.id, listingId: booking.listingId, startDate: booking.startDate, endDate: booking.endDate,
      createdAt: booking.createdAt, confirmedAt: confirmedAt.get(booking.id) ?? null, guests: booking.guests,
      evidenceStatus: booking.visitEvidence?.status ?? (booking.status === "CONFIRMED" ? BookingVisitEvidenceStatus.CANDIDATE : BookingVisitEvidenceStatus.INVALIDATED),
      bookingStatus: booking.status,
      countryCode: booking.visitEvidence?.countryCode ?? null, cityName: booking.visitEvidence?.cityName ?? null,
    })),
    reviews: reviews.map((review) => ({
      id: review.id, bookingId: review.bookingId, authorId: review.authorId, targetUserId: review.targetUserId,
      hostId: review.booking?.listing.hostId ?? null, direction: review.direction, status: review.status,
      rating: review.rating, comment: review.comment, publishedAt: review.publishedAt, updatedAt: review.updatedAt,
    })),
    languages,
    policy: options.policy,
    now: options.now,
  });
}

export async function evaluateQualityBehaviorAchievementsForEvent(input: { userId: string | null; type: AchievementEventType; }) {
  if (!input.userId) return { evaluated: false, reason: "EVENT_HAS_NO_USER", results: [] as QualityBehaviorEvaluation[] };
  const affected = QUALITY_BEHAVIOR_DEFINITIONS.filter((definition) => definition.eventTypes.includes(input.type)).map((definition) => definition.key);
  if (!affected.length) return { evaluated: false, reason: "NO_PHASE_4_RULES_FOR_EVENT", results: [] as QualityBehaviorEvaluation[] };
  const results = await evaluateQualityBehaviorAchievementsForUser(input.userId);
  return { evaluated: true, affected, results: results.filter((result) => affected.includes(result.key)) };
}

/** Explicit, disabled catalog initialization. It never assigns user progress or awards. */
export async function seedQualityBehaviorAchievementDefinitions() {
  for (const definition of QUALITY_BEHAVIOR_DEFINITIONS) {
    await prisma.travelAchievement.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key, name: definition.name, description: definition.description, category: definition.category,
        eligibilityRule: "QUALITY_BEHAVIOR_INTELLIGENCE", threshold: definition.threshold,
        isActive: false, definitionStatus: TravelAchievementDefinitionStatus.DRAFT, awardEnabled: false,
        eligibilityMetadata: { ruleVersion: QUALITY_BEHAVIOR_RULE_VERSION, blockers: definition.blockers, inactiveBenefit: definition.inactiveBenefit ?? null },
      },
      update: {},
    });
  }
  return { seededDefinitions: QUALITY_BEHAVIOR_DEFINITIONS.length, activatedDefinitions: 0 };
}

export async function reconcileQualityBehaviorAchievements(options: { userId?: string; cursor?: string; limit?: number } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const users = options.userId
    ? [{ id: options.userId }]
    : await prisma.user.findMany({
      where: { bookingVisitEvidence: { some: {} }, ...(options.cursor ? { id: { gt: options.cursor } } : {}) },
      select: { id: true }, orderBy: { id: "asc" }, take: limit,
    });
  const reports = await Promise.all(users.map(async (user) => ({ userId: user.id, results: await evaluateQualityBehaviorAchievementsForUser(user.id) })));
  return {
    dryRun: true,
    processedUsers: reports.length,
    reports,
    nextCursor: !options.userId && users.length === limit ? users.at(-1)?.id ?? null : null,
    awardIssued: false,
  };
}
