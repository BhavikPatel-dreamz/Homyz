import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

test("Dashboard Plus property comparison exposes only authorized, recorded portfolio metrics", () => {
  const service = source("services/host-booking-analytics.service.ts");
  const client = source("app/(protected)/host/insights/stats/booking-analytics/host-booking-analytics-client.tsx");

  assert.match(service, /accessibleHostListingWhere\(actor/);
  assert.match(service, /eligibleAccommodationRevenueCents/);
  assert.match(service, /averageBookingValueCents/);
  assert.match(service, /cancellationRatePercentage/);
  assert.match(service, /guestRating/);
  assert.match(service, /responseRateStatus: "DATA_UNAVAILABLE"/);
  assert.match(client, /Eligible revenue/);
  assert.match(client, /Avg booking value/);
  assert.match(client, /Guest rating/);
  assert.match(client, /Response rate is only tracked host-wide/);
});

test("advanced reports stay protected and private while Standard listing performance remains usable", () => {
  const earningsApi = source("app/api/v1/host/earnings/analytics/route.ts");
  const bookingApi = source("app/api/v1/host/insights/booking-analytics/route.ts");
  const listingApi = source("app/api/v1/host/insights/listing-performance/route.ts");

  assert.match(earningsApi, /requireHostDashboardFeature\(actor, "ADVANCED_EARNINGS"\)/);
  assert.match(bookingApi, /requireHostDashboardFeature\(actor, "BOOKING_BEHAVIOR"\)/);
  assert.match(earningsApi, /private, no-store/);
  assert.match(bookingApi, /private, no-store/);
  assert.match(listingApi, /includeAdvancedComparisons: entitlements\.features\.ADVANCED_PROPERTY_COMPARISON/);
});
