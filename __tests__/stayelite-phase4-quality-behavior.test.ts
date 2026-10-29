import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BookingVisitEvidenceStatus,
  CountryLanguageKind,
  ReviewDirection,
  ReviewStatus,
  TravelAchievementStatus,
} from "@/generated/prisma/enums";
import {
  QUALITY_BEHAVIOR_DEFINITIONS,
  evaluateQualityBehaviorAchievements,
  leadTimeHours,
  seasonForDate,
  type BookingRuleEvidence,
  type ReviewRuleEvidence,
} from "@/services/stayelite-quality-behavior.service";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const completedBooking = (index: number, overrides: Partial<BookingRuleEvidence> = {}): BookingRuleEvidence => {
  const startDate = day(`2026-${String((index % 12) + 1).padStart(2, "0")}-01`);
  return {
    id: `booking-${index}`,
    listingId: index <= 3 ? "listing-repeat" : `listing-${index}`,
    startDate,
    endDate: new Date(startDate.getTime() + (index >= 13 ? 15 : 3) * 86_400_000),
    createdAt: new Date(startDate.getTime() - 35 * 86_400_000),
    confirmedAt: new Date(startDate.getTime() - 30 * 86_400_000),
    guests: index === 1 ? 4 : 2,
    evidenceStatus: BookingVisitEvidenceStatus.QUALIFIED,
    bookingStatus: "CONFIRMED",
    countryCode: ["US", "FR", "GB", "JP", "IT", "SA", "AE", "CA", "AU", "BR", "DE", "ES", "MX", "IN", "ZA"][index - 1],
    cityName: ["Miami", "Paris", "London", "Tokyo", "Venice", "Riyadh", "Dubai", "Toronto", "Sydney", "Rio", "Berlin", "Madrid", "Mexico City", "Delhi", "Cape Town"][index - 1],
    ...overrides,
  };
};

const mapResults = (input: Parameters<typeof evaluateQualityBehaviorAchievements>[0]) =>
  new Map(evaluateQualityBehaviorAchievements(input).map((result) => [result.key, result]));

test("all five quality and eight behavioral definitions calculate from trusted fixtures without issuing awards", () => {
  const bookings = Array.from({ length: 15 }, (_, index) => completedBooking(index + 1));
  for (const [offset, month] of [10, 11, 12].entries()) {
    const startDate = day(`2028-${month}-01`);
    bookings[12 + offset] = completedBooking(13 + offset, {
      startDate,
      endDate: new Date(startDate.getTime() + 15 * 86_400_000),
    });
  }
  // Exact 12-hour Last Minute boundary on one qualifying booking.
  bookings[11] = completedBooking(12, {
    confirmedAt: new Date(bookings[11]!.startDate.getTime() - 12 * 3_600_000),
  });
  const hostRatings: ReviewRuleEvidence[] = Array.from({ length: 10 }, (_, index) => ({
    id: `host-review-${index + 1}`,
    bookingId: `booking-${index + 1}`,
    authorId: `host-${index + 1}`,
    targetUserId: "guest-1",
    hostId: `host-${index + 1}`,
    direction: ReviewDirection.HOST_TO_GUEST,
    status: ReviewStatus.PUBLISHED,
    rating: 5,
    comment: "Great guest",
    publishedAt: day(`2027-01-${String(index + 1).padStart(2, "0")}`),
    updatedAt: day(`2027-01-${String(index + 1).padStart(2, "0")}`),
  }));
  const guestReviews: ReviewRuleEvidence[] = Array.from({ length: 15 }, (_, index) => ({
    id: `guest-review-${index + 1}`,
    bookingId: `booking-${index + 1}`,
    authorId: "guest-1",
    targetUserId: `host-${index + 1}`,
    hostId: `host-${index + 1}`,
    direction: ReviewDirection.GUEST_TO_PROPERTY,
    status: ReviewStatus.PUBLISHED,
    rating: 5,
    comment: "A detailed and genuinely helpful written review.",
    publishedAt: day(`2027-02-${String(index + 1).padStart(2, "0")}`),
    updatedAt: day(`2027-02-${String(index + 1).padStart(2, "0")}`),
  }));
  const results = mapResults({
    bookings,
    reviews: [...hostRatings, ...guestReviews],
    languages: [
      { countryCode: "US", languageCode: "en", kind: CountryLanguageKind.PRIMARY_NATIVE, datasetVersion: "fixture-v1" },
      { countryCode: "FR", languageCode: "fr", kind: CountryLanguageKind.PRIMARY_NATIVE, datasetVersion: "fixture-v1" },
      { countryCode: "JP", languageCode: "ja", kind: CountryLanguageKind.PRIMARY_NATIVE, datasetVersion: "fixture-v1" },
    ],
    policy: {
      completionApproved: true,
      cancellationStreakPolicy: "ANY_CANCELLED_BOOKING_BREAKS",
      ratingEligibilityApproved: true,
      highQualityReviewApproved: true,
      highQualityReviewPredicate: (review) => review.comment.length >= 20,
      sequenceApproved: true,
      seasonPolicy: { hemisphere: "NORTH", calendar: "CALENDAR_YEAR" },
      languageSelectionApproved: true,
    },
  });

  assert.equal(results.size, 13);
  for (const definition of QUALITY_BEHAVIOR_DEFINITIONS) {
    assert.equal(results.get(definition.key)?.status, TravelAchievementStatus.ELIGIBLE, definition.key);
    assert.equal(results.get(definition.key)?.awardAuthorized, false, definition.key);
  }
  assert.equal(results.get("BADGE_CITY_COLLECTOR_V1")?.progress, 10);
  assert.equal(results.get("BADGE_LOYAL_NOMAD_V1")?.progress, 3);
  assert.equal(results.get("STICKER_LOYAL_WANDERER_V1")?.progress, 3);
  assert.equal(results.get("STICKER_PERFECT_GUEST_V1")?.progress, 10);
  assert.equal(results.get("STICKER_TEN_STAY_VETERAN_V1")?.progress, 10);
  assert.equal(results.get("STICKER_LANGUAGE_LEAPER_V1")?.progress, 3);
});

test("streaks, host uniqueness, dates, and guest-count thresholds honor exact boundaries", () => {
  const start = day("2026-07-01");
  const exactEarly = completedBooking(1, { startDate: start, endDate: day("2026-07-04"), confirmedAt: new Date(start.getTime() - 30 * 86_400_000) });
  const justLate = completedBooking(2, { startDate: start, endDate: day("2026-07-04"), confirmedAt: new Date(start.getTime() - 30 * 86_400_000 + 1) });
  const exactLastMinute = completedBooking(3, { startDate: start, endDate: day("2026-07-04"), confirmedAt: new Date(start.getTime() - 12 * 3_600_000), guests: 4 });
  assert.equal(leadTimeHours(exactEarly), 720);
  assert.ok((leadTimeHours(justLate) ?? 0) < 720);
  const results = mapResults({
    bookings: [exactEarly, justLate, exactLastMinute],
    reviews: [
      ...Array.from({ length: 10 }, (_, index) => ({ id: `same-host-${index}`, bookingId: index < 3 ? `booking-${index + 1}` : null, authorId: "host", targetUserId: "guest", hostId: "same-host", direction: ReviewDirection.HOST_TO_GUEST, status: ReviewStatus.PUBLISHED, rating: 5, comment: "ok", updatedAt: new Date(index), publishedAt: new Date(index) })),
    ],
    languages: [],
    policy: { completionApproved: true, ratingEligibilityApproved: true },
  });
  assert.equal(results.get("STICKER_EARLY_BIRD_V1")?.progress, 1);
  assert.equal(results.get("STICKER_LAST_MINUTE_LUCK_V1")?.progress, 1);
  assert.equal(results.get("STICKER_GROUP_PACK_V1")?.progress, 1);
  assert.equal(results.get("STICKER_PERFECT_GUEST_V1")?.progress, 1, "same host must not count twice");
  assert.equal(seasonForDate(day("2026-01-15"), "NORTH"), "WINTER");
  assert.equal(seasonForDate(day("2026-01-15"), "SOUTH"), "SUMMER");
});

test("unapproved policies retain calculated progress but cannot create definitive eligibility", () => {
  const bookings = Array.from({ length: 10 }, (_, index) => completedBooking(index + 1));
  const results = mapResults({ bookings, reviews: [], languages: [], policy: {} });
  assert.equal(results.get("BADGE_ZERO_CANCEL_PRO_V1")?.authorization, "BLOCKED_BY_POLICY");
  assert.equal(results.get("BADGE_ZERO_CANCEL_PRO_V1")?.status, TravelAchievementStatus.IN_PROGRESS);
  assert.equal(results.get("BADGE_SUPER_REVIEWER_V1")?.authorization, "BLOCKED_BY_POLICY");
  assert.equal(results.get("STICKER_SEASON_HOPPER_V1")?.policyBlockers.includes("DEC-013"), true);
  assert.equal(results.get("STICKER_LANGUAGE_LEAPER_V1")?.policyBlockers.includes("DEC-015"), true);
  assert.equal(results.get("STICKER_TEN_STAY_VETERAN_V1")?.definitiveEligibility, false);
});
