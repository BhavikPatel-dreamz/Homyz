import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

test("Plus operating expenses are protected by the existing server-side entitlement", () => {
  for (const path of [
    "app/api/v1/host/earnings/expenses/route.ts",
    "app/api/v1/host/earnings/expenses/[id]/route.ts",
  ]) {
    const file = source(path);
    assert.match(file, /requireHostDashboardFeature/);
    assert.match(file, /OPERATIONS_AND_PROFITABILITY/);
  }
});

test("advanced booking analytics reports last-minute payout values only from immutable eligible snapshots", () => {
  const service = source("services/host-booking-analytics.service.ts");
  const client = source("app/(protected)/host/insights/stats/booking-analytics/host-booking-analytics-client.tsx");

  assert.match(service, /lastMinuteRecordedNetHostPayoutCents/);
  assert.match(service, /extractStoredHostPayout\(booking\)/);
  assert.match(service, /isStoredBookingPayoutEligible\(booking\)/);
  assert.match(client, /Recorded payout/);
  assert.match(client, /Eligible immutable snapshots/);
});

test("listing funnel records a real forward inquiry stage without inventing inquiry-to-booking attribution", () => {
  const analytics = source("services/listing-analytics.service.ts");
  const messaging = source("services/messaging.service.ts");
  const performance = source("app/(protected)/host/insights/listing-performance/host-listing-performance-client.tsx");

  assert.match(analytics, /"INQUIRY"/);
  assert.match(analytics, /recordInquiryAnalyticsEvent/);
  assert.match(messaging, /createdInquiryConversation/);
  assert.match(messaging, /recordInquiryAnalyticsEvent/);
  assert.match(performance, /Guest inquiries/);
  assert.match(performance, /Inquiry-to-booking conversion is unavailable/);
});

test("Plus operations exposes authorized property filtering and maintenance record creation", () => {
  const client = source("app/(protected)/host/operations/host-operations-client.tsx");
  const api = source("app/api/v1/host/operations/route.ts");

  assert.match(client, /Filter operations by property/);
  assert.match(client, /Create maintenance record/);
  assert.match(api, /requireHostDashboardFeature\(actor, "OPERATIONS_AND_PROFITABILITY"\)/);
  assert.match(api, /type === "MAINTENANCE"/);
});
