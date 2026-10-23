import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { BookingStatus } from "@/generated/prisma/enums";
import { calculateBookingLeadTimeDays, calculateWeightedOccupancy, isLastMinuteBooking, LAST_MINUTE_LEAD_DAYS } from "@/lib/booking/booking-analytics";
import { calculateDashboardInventoryByDate } from "@/lib/dashboard/host-inventory";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 14 uses calendar-date lead time and one last-minute threshold", () => {
  assert.equal(calculateBookingLeadTimeDays(new Date("2026-10-10T23:59:00.000Z"), "2026-10-10"), 0);
  assert.equal(calculateBookingLeadTimeDays(new Date("2026-10-10T23:59:00.000Z"), "2026-10-13"), 3);
  assert.equal(LAST_MINUTE_LEAD_DAYS, 3);
  assert.equal(isLastMinuteBooking(3), true);
  assert.equal(isLastMinuteBooking(4), false);
});

test("Phase 14 inventory heatmap preserves confirmed-booking precedence over calendar blocks", () => {
  const points = calculateDashboardInventoryByDate({
    listings: [{ id: "listing-a", blockedDates: ["2026-10-02", "2026-10-03"] }],
    bookings: [{ listingId: "listing-a", status: BookingStatus.CONFIRMED, startDate: new Date("2026-10-01T00:00:00.000Z"), endDate: new Date("2026-10-03T00:00:00.000Z") }],
    startDateKey: "2026-10-01",
    endDateKeyExclusive: "2026-10-04",
  });

  assert.deepEqual(points.map((point) => [point.dateKey, point.bookedNights, point.blockedNights, point.bookableNights]), [
    ["2026-10-01", 1, 0, 1],
    ["2026-10-02", 1, 0, 1],
    ["2026-10-03", 0, 1, 0],
  ]);
  assert.equal(calculateWeightedOccupancy(3, 4), 75);
  assert.equal(calculateWeightedOccupancy(0, 0), null);
});

test("Phase 14 aggregates authorized confirmed bookings from distinct event and stay-date bases", () => {
  const service = read("services/host-booking-analytics.service.ts");

  assert.match(service, /status: BookingStatus\.CONFIRMED/);
  assert.match(service, /createdAt: \{ gte: eventStart, lte: period\.endDate \}/);
  assert.match(service, /calculateBookingLeadTimeDays/);
  assert.match(service, /extractStoredHostPayout/);
  assert.match(service, /isStoredBookingPayoutEligible/);
  assert.match(service, /Calendar availability is not versioned/);
  assert.match(service, /calculateDashboardInventoryByDate/);
  assert.match(read("services/host-dashboard.service.ts"), /@\/lib\/dashboard\/host-inventory/);
});

test("Phase 14 exposes host-authorized Stats drill-downs without adding an Insights tab", () => {
  const api = read("app/api/v1/host/insights/booking-analytics/route.ts");
  const statsTab = read("components/host/insights/insights-stats-tab.tsx");
  const client = read("app/(protected)/host/insights/stats/booking-analytics/host-booking-analytics-client.tsx");
  const detail = read("app/(protected)/host/insights/stats/booking-analytics/[metric]/page.tsx");

  assert.match(api, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(statsTab, /Advanced booking analytics/);
  assert.match(statsTab, /\/host\/insights\/stats\/booking-analytics/);
  assert.match(client, /DatePeriodPicker/);
  assert.match(client, /PeriodComparisonModal/);
  assert.match(client, /Booking time/);
  assert.match(client, /Occupancy/);
  assert.match(client, /Realized nightly rate/);
  assert.match(detail, /booking-times/);
});

test("Phase 14 redesign keeps the overview compact and loads the full portfolio only in its comparison view", () => {
  const service = read("services/host-booking-analytics.service.ts");
  const api = read("app/api/v1/host/insights/booking-analytics/route.ts");
  const client = read("app/(protected)/host/insights/stats/booking-analytics/host-booking-analytics-client.tsx");
  const detail = read("app/(protected)/host/insights/stats/booking-analytics/[metric]/page.tsx");

  assert.match(service, /propertyLimit/);
  assert.match(service, /propertiesTotal/);
  assert.match(api, /propertyLimitValue/);
  assert.match(client, /Booking analytics sections/);
  assert.match(client, /Selected date/);
  assert.match(client, /View all \{data\.propertiesTotal\} properties/);
  assert.match(client, /propertyLimit/, "The dedicated page keeps its full-portfolio request through filter updates.");
  assert.match(detail, /property-comparison/);
});
