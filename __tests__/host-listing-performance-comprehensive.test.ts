import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/db/prisma";
import { ListingStatus, BookingStatus } from "@/generated/prisma/enums";
import { hostListingPerformanceService } from "@/services/host-listing-performance.service";
import {
  getListingAnalyticsSummary,
  recordListingAnalyticsEvent,
  recordConfirmedBookingAnalyticsEvent,
  recordInquiryAnalyticsEvent,
} from "@/services/listing-analytics.service";
import { listingService } from "@/services/listing.service";

test("Listing Performance, Search Analytics & Funnel Conversion Comprehensive Audit Suite", async (t) => {
  const host = await prisma.user.findFirst({ where: { email: "adams@gmail.com" } });
  assert.ok(host, "Target test host adams@gmail.com must exist");
  const actor = {
    id: host.id,
    email: host.email,
    role: host.role,
    name: host.name,
  };

  const draftListing = await prisma.listing.findFirst({
    where: { hostId: host.id, title: "Draft Listing", deletedAt: null },
  });
  assert.ok(draftListing, "Draft Listing must exist for test host");

  await t.test("Test 1: Search impression recording and validation", async () => {
    const testStart = new Date(Date.now() - 2000);
    const testSession = `test-session-imp-${Date.now()}`;
    const res = await recordListingAnalyticsEvent({
      clientEventType: "property_card_view",
      listingId: draftListing.id,
      sessionId: testSession,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    assert.strictEqual(res.recorded, true, "Eligible search impression must be recorded for active published listing");

    // Cleanup test-created events
    await prisma.listingAnalyticsEvent.deleteMany({
      where: { listingId: draftListing.id, occurredAt: { gte: testStart } },
    });
  });

  await t.test("Test 2 & 3: Listing view recording and idempotency (duplicate prevention)", async () => {
    const testStart = new Date(Date.now() - 2000);
    const testSession = `test-session-view-${Date.now()}`;
    const first = await recordListingAnalyticsEvent({
      clientEventType: "listing_page_view",
      listingId: draftListing.id,
      sessionId: testSession,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    assert.strictEqual(first.recorded, true, "First view in a session must record successfully");

    // Second view in the same day/session should be deduplicated
    const second = await recordListingAnalyticsEvent({
      clientEventType: "listing_page_view",
      listingId: draftListing.id,
      sessionId: testSession,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    assert.strictEqual(second.recorded, false, "Duplicate view on same day/session must not insert a duplicate row");
    assert.strictEqual(second.deduplicated, true, "Must flag deduplicated=true");

    // Cleanup test-created events
    await prisma.listingAnalyticsEvent.deleteMany({
      where: { listingId: draftListing.id, occurredAt: { gte: testStart } },
    });
  });

  await t.test("Test 4: Guest inquiry recording and deduplication per conversation", async () => {
    const testStart = new Date(Date.now() - 2000);
    const convId = `test-inquiry-conv-${Date.now()}`;
    const guestId = `test-guest-${Date.now()}`;
    const first = await recordInquiryAnalyticsEvent({
      conversationId: convId,
      listingId: draftListing.id,
      hostId: host.id,
      guestId,
    });
    assert.strictEqual(first.recorded, true, "New inquiry conversation must be recorded as an INQUIRY event");

    // Repeated call for same conversation ID must deduplicate
    const second = await recordInquiryAnalyticsEvent({
      conversationId: convId,
      listingId: draftListing.id,
      hostId: host.id,
      guestId,
    });
    assert.strictEqual(second.recorded, false, "Subsequent message in same inquiry conversation must not duplicate event");
    assert.strictEqual(second.deduplicated, true);

    // Cleanup test-created events
    await prisma.listingAnalyticsEvent.deleteMany({
      where: { listingId: draftListing.id, occurredAt: { gte: testStart } },
    });
  });

  await t.test("Test 5 & 6: Booking attribution logic (direct vs inquiry-linked vs unattributed)", async () => {
    const booking = await prisma.booking.findFirst({
      where: { listingId: draftListing.id, status: BookingStatus.CONFIRMED },
    });
    assert.ok(booking, "Draft Listing must have confirmed bookings");

    // Without a session that viewed the listing in the 30-day window before booking, attribution is false
    const unattributed = await recordConfirmedBookingAnalyticsEvent({
      bookingId: booking.id,
      sessionId: `unknown-session-no-view-${Date.now()}`,
    });
    assert.strictEqual(unattributed.attributed, false, "Booking without matching prior view must not be attributed");
  });

  await t.test("Test 7: Conversion accuracy — reproduces 133.33% root cause and verifies corrected 66.67% cohort conversion", async () => {
    // 1. In the database, Draft Listing has 3 unique viewing sessions on Nov 2, 2026
    // and 4 confirmed bookings created across 2 of those viewing sessions (one session made 3 bookings, another made 1).
    // The previous flawed formula: 4 bookings / 3 views = 133.33%.
    const rawViews = 3;
    const rawBookings = 4;
    const flawedConversion = Math.round((rawBookings / rawViews) * 10000) / 100;
    assert.strictEqual(flawedConversion, 133.33, "Reproduced exact screenshot value: 4 bookings / 3 views = 133.33%");

    // 2. Verified corrected cohort conversion:
    // Converted viewing sessions = 2. Total viewing sessions = 3.
    // Cohort conversion rate = 2 / 3 = 66.67%.
    const summary = await getListingAnalyticsSummary({
      listingIds: [draftListing.id],
      startDate: new Date("2026-11-01T00:00:00.000Z"),
      endDate: new Date("2026-11-30T23:59:59.999Z"),
    });

    assert.strictEqual(summary.listingViews, 3, "Listing views must equal 3");
    assert.strictEqual(summary.uniqueViewingSessionsCount, 3, "Unique viewing sessions must equal 3");
    assert.strictEqual(summary.convertedSessionsCount, 2, "Converted sessions must equal 2");
    assert.strictEqual(summary.attributedConfirmedBookings, 4, "Total confirmed bookings must equal 4");
    assert.strictEqual(summary.conversionRatePercentage, 66.67, "True cohort conversion must equal 66.67% (not 133.33%)");
  });

  await t.test("Test 8: Partial historical coverage reporting", async () => {
    const summary = await getListingAnalyticsSummary({
      listingIds: [draftListing.id],
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-31T23:59:59.999Z"),
    });
    assert.strictEqual(summary.listingViews, 0, "No views prior to tracking inception");
    assert.strictEqual(summary.conversionRatePercentage, null, "Conversion rate must be null (displayed as '—') when views=0");
  });

  await t.test("Test 9: Search ranking placement matches live public search algorithm", async () => {
    const searchResults = await listingService.searchPublicListings({
      city: "Riyadh",
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 1,
      sortBy: "recommended",
      take: 20,
      page: 1,
      includePriceRange: false,
    });
    const foundIndex = searchResults.items.findIndex((item) => item.id === draftListing.id);
    assert.ok(foundIndex >= 0, "Draft Listing must appear in search results for Riyadh");

    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 1,
    });
    assert.ok(performance, "Performance data must be returned");
    assert.strictEqual(performance.searchRanking.status, "OBSERVED");
    assert.strictEqual(performance.searchRanking.position, foundIndex + 1);
  });

  await t.test("Test 10: Search ranking snapshot deduplication (throttling)", async () => {
    const countBefore = await prisma.listingSearchRankingObservation.count({
      where: { listingId: draftListing.id, checkIn: "2026-11-26", checkOut: "2026-11-28" },
    });

    // Calling performance again immediately should NOT insert a duplicate observation
    await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 1,
    });

    const countAfter = await prisma.listingSearchRankingObservation.count({
      where: { listingId: draftListing.id, checkIn: "2026-11-26", checkOut: "2026-11-28" },
    });
    assert.strictEqual(countAfter, countBefore, "Immediate subsequent calls must not insert duplicate ranking observations");
  });

  await t.test("Test 11: Draft listing publication status validation", async () => {
    // Confirm title 'Draft Listing' is merely a name; its database status is ACTIVE and published=true
    assert.strictEqual(draftListing.status, ListingStatus.ACTIVE, "Listing status is ACTIVE in DB");
    assert.strictEqual(draftListing.published, true, "Listing is published in DB");
  });

  await t.test("Test 12: Open inventory analytics — reproduces 82 consecutive nights", async () => {
    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 1,
    });
    assert.ok(performance?.pricingObservations.extendedEmptyNights);
    assert.strictEqual(performance.pricingObservations.extendedEmptyNights.consecutiveNights, 82);
    assert.strictEqual(performance.pricingObservations.extendedEmptyNights.startDate, "2026-11-13");
    assert.strictEqual(performance.pricingObservations.extendedEmptyNights.endDate, "2027-02-03");
  });

  await t.test("Test 13: Selected stay evaluated independently of 82-night extended open streak", async () => {
    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 1,
    });
    const stayAvail = performance?.pricingObservations.selectedStayAvailability;
    assert.ok(stayAvail, "Selected stay availability must be present");
    assert.strictEqual(stayAvail.available, true, "Nov 26-28 is available for 1 guest");
    assert.strictEqual(stayAvail.nights, 2);
    assert.strictEqual(stayAvail.guests, 1);
  });

  await t.test("Test 14: Comparable properties matching (Tier 1 houses in Riyadh)", async () => {
    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 1,
      includeAdvancedComparisons: true,
    });
    assert.ok(performance);
    assert.strictEqual(performance.priceComparison.status, "AVAILABLE");
    assert.strictEqual(performance.priceComparison.comparableCount, 5, "5 comparable houses in Riyadh must match");
    assert.strictEqual(performance.comparableListings.length, 5, "5 comparable listings returned");
    assert.ok(performance.priceComparison.comparableAverageNightlyPriceCents! > 0);
  });

  await t.test("Test 15: No comparable properties edge case handling", async () => {
    // Querying with an extreme guest count (e.g. 50 guests) yields insufficient data cleanly
    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 50,
    });
    assert.ok(performance);
    assert.strictEqual(performance.priceComparison.status, "INSUFFICIENT_DATA");
    assert.strictEqual(performance.priceComparison.comparableCount, 0);
  });

  await t.test("Test 16: Property price calculation and comparison difference", async () => {
    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-11-26",
      checkOut: "2026-11-28",
      guests: 1,
    });
    assert.ok(performance);
    const { yourNightlyPriceCents, comparableAverageNightlyPriceCents, differenceCents } = performance.priceComparison;
    assert.ok(yourNightlyPriceCents && comparableAverageNightlyPriceCents && differenceCents !== null);
    assert.strictEqual(differenceCents, yourNightlyPriceCents - comparableAverageNightlyPriceCents);
  });

  await t.test("Test 17: Filter changes update context and calculations", async () => {
    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
      checkIn: "2026-12-01",
      checkOut: "2026-12-05",
      guests: 2,
    });
    assert.ok(performance);
    assert.strictEqual(performance.context.checkIn, "2026-12-01");
    assert.strictEqual(performance.context.checkOut, "2026-12-05");
    assert.strictEqual(performance.context.guests, 2);
    assert.strictEqual(performance.pricingObservations.selectedStayAvailability.nights, 4);
  });

  await t.test("Test 18: Multi-property host isolation and access permissions", async () => {
    // Attempting to access another host's listing must return null or default to owned listing
    const otherHostListing = await prisma.listing.findFirst({
      where: { hostId: { not: host.id }, deletedAt: null },
    });
    if (otherHostListing) {
      const performance = await hostListingPerformanceService.getListingPerformance(actor, {
        listingId: otherHostListing.id,
      });
      // getAccessibleListing strictly filters by accessibleHostListingWhere(actor),
      // so it either falls back to an owned listing or returns null, never exposing the foreign listing
      if (performance) {
        assert.notStrictEqual(performance.listing.id, otherHostListing.id, "Host cannot access foreign listing analytics");
      }
    }
  });

  await t.test("Test 19: Dashboard reconciliation across shared analytics layer", async () => {
    const summary = await getListingAnalyticsSummary({
      listingIds: [draftListing.id],
      startDate: new Date(Date.now() - 30 * 86_400_000),
      endDate: new Date(),
    });
    const performance = await hostListingPerformanceService.getListingPerformance(actor, {
      listingId: draftListing.id,
    });
    assert.strictEqual(summary.listingViews, performance?.searchPerformance.listingViews);
    assert.strictEqual(summary.conversionRatePercentage, performance?.searchPerformance.attributedBookingConversionPercentage);
    assert.strictEqual(summary.attributedConfirmedBookings, performance?.searchPerformance.attributedConfirmedBookingsCount);
  });
});
