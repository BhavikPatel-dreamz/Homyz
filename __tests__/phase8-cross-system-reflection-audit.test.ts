import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateStayAvailability } from "../lib/booking/availability";
import { getAuthoritativePriceBreakdown } from "../lib/booking/booking-price";
import { calculateBookingPrice } from "../services/pricing.service";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("Phase 8: base, custom, fee, and guest pricing reconcile through the authoritative quote", async () => {
  const quote = await calculateBookingPrice({
    checkIn: "2031-12-24",
    checkOut: "2031-12-27",
    weekdayBasePrice: 50_000,
    weekendPrice: 60_000,
    customPrices: { "2031-12-25": 75_000 },
    cleaningFee: 10_000,
    extraGuestFee: 5_000,
    baseGuests: 3,
    guests: 5,
    pets: 1,
    petFee: 3_000,
    hostServiceFeePercentage: 10,
  });

  assert.equal(quote.breakdown.find((night) => night.date === "2031-12-25")?.price, 75_000);
  assert.equal(quote.breakdown.find((night) => night.date === "2031-12-25")?.rateSource, "CUSTOM");
  assert.equal(quote.cleaningFee, 10_000, "cleaning is charged once per booking");
  assert.equal(quote.extraGuestFee, 30_000, "two extra guests are charged across three nights");
  assert.equal(quote.petFee, 3_000);

  const snapshot = getAuthoritativePriceBreakdown({
    startDate: "2031-12-24",
    endDate: "2031-12-27",
    nightlyPrice: quote.baseNightlyPrice,
    totalPrice: quote.guestTotal,
    currency: quote.currency,
    priceBreakdown: { ...quote, pricingSnapshotVersion: "v1" },
  });
  assert.equal(snapshot.totalPrice, quote.guestTotal);
  assert.equal(snapshot.cleaningFee, quote.cleaningFee);
  assert.equal(snapshot.extraGuestFee, quote.extraGuestFee);
  assert.ok(quote.payoutBreakdown.netHostPayout < quote.guestTotal, "host payout remains distinct from guest total");
});

test("Phase 8: availability rules reject capacity, blocked dates, overlap, and invalid stay lengths at the shared boundary", () => {
  const listing = {
    guests: 5,
    minNights: 2,
    maxNights: 5,
    blockedDates: ["2031-12-26"],
    allowSameDayRequests: true,
    advanceNotice: "Same day",
  };
  const now = new Date("2031-12-01T12:00:00Z");

  assert.equal(validateStayAvailability({ listing, checkIn: "2031-12-20", checkOut: "2031-12-22", guests: 5, now }).available, true);
  assert.equal(validateStayAvailability({ listing, checkIn: "2031-12-20", checkOut: "2031-12-22", guests: 6, now }).available, false);
  assert.equal(validateStayAvailability({ listing, checkIn: "2031-12-20", checkOut: "2031-12-21", guests: 2, now }).available, false);
  assert.equal(validateStayAvailability({ listing, checkIn: "2031-12-24", checkOut: "2031-12-27", guests: 2, now }).available, false);
  assert.equal(validateStayAvailability({
    listing: { ...listing, blockedDates: [] },
    checkIn: "2031-12-24",
    checkOut: "2031-12-27",
    guests: 2,
    now,
    unavailableRanges: [{ start: "2031-12-25", end: "2031-12-28" }],
  }).available, false);
});

test("Phase 8: host configuration writes preserve fee and price reflection without rewriting booking snapshots", () => {
  const listingService = read("services/listing.service.ts");
  const bookingService = read("services/booking.service.ts");

  assert.match(listingService, /cleaningFee: input\.cleaningFee \?\? 0/);
  assert.match(listingService, /const sanitizedCustom: Record<string, number> = \{\}/);
  assert.doesNotMatch(listingService, /Strictly protect confirmed\/active reservations: preserve prior pricing snapshot/);
  assert.match(bookingService, /priceBreakdown: \{[\s\S]*\.\.\.quote[\s\S]*pricingSnapshotVersion: "v1"/);
  assert.match(bookingService, /pg_advisory_xact_lock\(hashtext\(\$\{input\.listingId\}\)\)/);
  assert.match(bookingService, /currentListing\.updatedAt\.getTime\(\) !== listing\.updatedAt\.getTime\(\)/);
});

test("Phase 8: calendar, search, final booking, and dashboard use shared authoritative state", () => {
  const availability = read("lib/booking/availability.ts");
  const listingService = read("services/listing.service.ts");
  const bookingService = read("services/booking.service.ts");
  const dashboardService = read("services/host-dashboard.service.ts");

  assert.match(availability, /validateStayAvailability/);
  assert.match(listingService, /validateStayAvailability\(\{/);
  assert.match(bookingService, /latestAvailability = validateStayAvailability/);
  assert.match(listingService, /protectedDatesSet/);
  assert.match(dashboardService, /extractStoredHostPayout/);
  assert.match(dashboardService, /cancellation\?\.isExcluded !== true/);
  assert.match(dashboardService, /calculateDashboardInventory/);
});
