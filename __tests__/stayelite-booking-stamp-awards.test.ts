import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { BookingStatus, AchievementEventType, TravelStampOwnership } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { processAchievementEvent, recordTrustedAchievementEvent } from "@/services/achievement-event.service";
import { reconcileTravelerHistory } from "@/services/travel-reconciliation.service";
import {
  addTravelStampSelections,
  awardSystemTravelStamps,
  getTravelerStamps,
  setStampPublic,
} from "@/services/travel-stamp.service";

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

test("completed booking → verified destination → system-earned travel stamps is correct, persistent, private when requested, and idempotent", async (t) => {
  if (process.env.STAYELITE_DB_TESTS !== "true") {
    t.skip("Set STAYELITE_DB_TESTS=true only with an explicitly approved isolated database migrated through 20261029123000.");
    return;
  }

  try {
    await prisma.userTravelStamp.count({ take: 1 });
  } catch (error: any) {
    if (["P2021", "P1001", "P1017"].includes(error?.code)) {
      t.skip("A reachable isolated database with the StayElite migrations is required.");
      return;
    }
    throw error;
  }

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [host, parisGuest, lyonGuest, usaGuest, ineligibleGuest, eventGuest] = await Promise.all([
    prisma.user.create({ data: { email: `stamp-host-${nonce}@example.test` } }),
    prisma.user.create({ data: { email: `stamp-paris-${nonce}@example.test` } }),
    prisma.user.create({ data: { email: `stamp-lyon-${nonce}@example.test` } }),
    prisma.user.create({ data: { email: `stamp-usa-${nonce}@example.test` } }),
    prisma.user.create({ data: { email: `stamp-ineligible-${nonce}@example.test` } }),
    prisma.user.create({ data: { email: `stamp-event-${nonce}@example.test` } }),
  ]);
  const userIds = [host.id, parisGuest.id, lyonGuest.id, usaGuest.id, ineligibleGuest.id, eventGuest.id];
  const slugPrefix = `system-award-${nonce}`;
  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    await prisma.travelStamp.deleteMany({ where: { slug: { startsWith: slugPrefix } } }).catch(() => undefined);
  });

  const [franceStamp, parisStamp, usaStamp] = await Promise.all([
    prisma.travelStamp.create({
      data: { slug: `${slugPrefix}-france`, displayName: "France", countryCode: "FR", category: "COUNTRY", eligibilityRule: "VISIT_COUNTRY", ruleThreshold: 1, iconUrl: "/test/france.svg" },
    }),
    prisma.travelStamp.create({
      data: { slug: `${slugPrefix}-parisian-pulse`, displayName: "Parisian Pulse", title: "Parisian Pulse", country: "France", countryCode: "FR", city: "Paris", category: "CITY", eligibilityRule: "VISIT_CITY", ruleThreshold: 1, iconUrl: "/test/paris.svg" },
    }),
    prisma.travelStamp.create({
      data: { slug: `${slugPrefix}-usa`, displayName: "United States", countryCode: "US", category: "COUNTRY", eligibilityRule: "VISIT_COUNTRY", ruleThreshold: 1, iconUrl: "/test/us.svg" },
    }),
  ]);

  const [parisListing, lyonListing, newYorkListing] = await Promise.all([
    prisma.listing.create({ data: { hostId: host.id, title: `Paris ${nonce}`, description: "test", price: 10000, country: "France", city: "Paris" } }),
    prisma.listing.create({ data: { hostId: host.id, title: `Lyon ${nonce}`, description: "test", price: 10000, country: "France", city: "Lyon" } }),
    prisma.listing.create({ data: { hostId: host.id, title: `NY ${nonce}`, description: "test", price: 10000, country: "United States", city: "New York" } }),
  ]);
  const createCompleted = (userId: string, listingId: string) => prisma.booking.create({
    data: { userId, listingId, status: BookingStatus.CONFIRMED, startDate: daysAgo(8), endDate: daysAgo(2) },
  });
  const [, , , eventBooking] = await Promise.all([
    createCompleted(parisGuest.id, parisListing.id),
    createCompleted(lyonGuest.id, lyonListing.id),
    createCompleted(usaGuest.id, newYorkListing.id),
    createCompleted(eventGuest.id, parisListing.id),
    prisma.booking.create({ data: { userId: ineligibleGuest.id, listingId: parisListing.id, status: BookingStatus.PENDING, startDate: daysAgo(8), endDate: daysAgo(2) } }),
    prisma.booking.create({ data: { userId: ineligibleGuest.id, listingId: parisListing.id, status: BookingStatus.CANCELLED, startDate: daysAgo(8), endDate: daysAgo(2) } }),
    prisma.booking.create({ data: { userId: ineligibleGuest.id, listingId: parisListing.id, status: BookingStatus.CONFIRMED, startDate: daysFromNow(3), endDate: daysFromNow(6) } }),
  ]);

  // A manual selection is not an earned award. The system award remains a
  // distinct, immutable record with verified booking provenance.
  await addTravelStampSelections(parisGuest.id, { catalogStampIds: [franceStamp.id] });
  const first = await reconcileTravelerHistory(parisGuest.id);
  assert.ok(first.awardedStampsCount >= 2);
  assert.equal(await prisma.userDestination.count({ where: { userId: parisGuest.id } }), 2, "France and Paris are verified destinations");

  const parisAwards = await getTravelerStamps(parisGuest.id);
  const franceRows = parisAwards.filter((stamp) => stamp.stampId === franceStamp.id);
  assert.equal(franceRows.length, 2, "manual and system provenance are separate");
  assert.equal(franceRows.filter((stamp) => stamp.isSystemAwarded).length, 1);
  assert.equal(franceRows.filter((stamp) => !stamp.isSystemAwarded).length, 1);
  assert.ok(parisAwards.some((stamp) => stamp.stampId === parisStamp.id && stamp.isSystemAwarded));
  assert.equal(parisAwards.some((stamp) => stamp.stampId === usaStamp.id && stamp.isSystemAwarded), false);

  const franceAward = franceRows.find((stamp) => stamp.isSystemAwarded)!;
  await setStampPublic(parisGuest.id, franceAward.id, false);
  assert.equal((await getTravelerStamps(parisGuest.id, { publicOnly: true })).some((stamp) => stamp.id === franceAward.id), false, "per-stamp privacy applies to verified awards");

  const lyonResult = await awardSystemTravelStamps(lyonGuest.id);
  assert.ok(lyonResult.awardedCount >= 1);
  const lyonAwards = await getTravelerStamps(lyonGuest.id);
  assert.ok(lyonAwards.some((stamp) => stamp.stampId === franceStamp.id && stamp.isSystemAwarded));
  assert.equal(lyonAwards.some((stamp) => stamp.stampId === parisStamp.id), false, "another French city never earns the Paris sticker");

  const usaResult = await awardSystemTravelStamps(usaGuest.id);
  assert.ok(usaResult.awardedCount >= 1);
  const usaAwards = await getTravelerStamps(usaGuest.id);
  assert.ok(usaAwards.some((stamp) => stamp.stampId === usaStamp.id && stamp.isSystemAwarded));
  assert.equal(usaAwards.some((stamp) => stamp.stampId === franceStamp.id || stamp.stampId === parisStamp.id), false, "another country earns only its configured country badge");

  assert.equal((await awardSystemTravelStamps(ineligibleGuest.id)).awardedCount, 0, "pending, cancelled, and future stays never award");
  assert.equal((await getTravelerStamps(ineligibleGuest.id)).length, 0);

  const [one, two] = await Promise.all([
    awardSystemTravelStamps(parisGuest.id),
    awardSystemTravelStamps(parisGuest.id),
  ]);
  assert.equal(one.awardedCount + two.awardedCount, 0, "repeated/concurrent reconciliation is idempotent");
  assert.equal(await prisma.userTravelStamp.count({ where: { userId: parisGuest.id, stampId: parisStamp.id, ownership: TravelStampOwnership.SYSTEM_AWARDED } }), 1);

  const event = await recordTrustedAchievementEvent({
    type: AchievementEventType.STAY_COMPLETION_CANDIDATE,
    sourceEntityType: "BOOKING",
    sourceEntityId: eventBooking.id,
    bookingId: eventBooking.id,
    userId: eventGuest.id,
    occurredAt: daysAgo(2),
    idempotencyKey: `test:completed-paris:${nonce}`,
  });
  const processed = await processAchievementEvent(event.id, `test-worker-${nonce}`);
  assert.equal(processed.status, "PROCESSED");
  assert.ok(processed.stampAward?.awardedCount, "completion event issues system awards");
  await processAchievementEvent(event.id, `test-worker-retry-${nonce}`);
  assert.equal(await prisma.userTravelStamp.count({ where: { userId: eventGuest.id, stampId: parisStamp.id, ownership: TravelStampOwnership.SYSTEM_AWARDED } }), 1, "duplicate delivery creates no duplicate award");
});
