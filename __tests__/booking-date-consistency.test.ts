import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  bookingDateKey,
  compareBookingDates,
  differenceInBookingNights,
  formatBookingDate,
  formatBookingDateRange,
  parseBookingDate,
} from "../lib/booking/booking-date";
import { toBookingDTO } from "../services/mappers";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const originalTimezone = process.env.TZ;
for (const timezone of ["Asia/Riyadh", "Asia/Kolkata", "UTC", "America/New_York"]) {
  process.env.TZ = timezone;
  assert.equal(bookingDateKey("2026-10-12"), "2026-10-12", `${timezone}: date key is stable`);
  assert.equal(formatBookingDate("2026-10-12"), "Oct 12, 2026", `${timezone}: single date is stable`);
  assert.equal(
    formatBookingDateRange("2026-10-12", "2026-10-14"),
    "Oct 12 – Oct 14, 2026",
    `${timezone}: date range is stable`,
  );
  assert.equal(parseBookingDate("2026-10-12").toISOString(), "2026-10-12T00:00:00.000Z");
  assert.equal(differenceInBookingNights("2026-10-12", "2026-10-14"), 2);
  assert.equal(compareBookingDates("2026-10-12", "2026-10-14"), -1);
}
process.env.TZ = originalTimezone;

const dto = toBookingDTO({
  id: "booking-date-test",
  userId: "guest-1",
  listingId: "listing-1",
  status: "CONFIRMED",
  startDate: new Date("2026-10-12T00:00:00.000Z"),
  endDate: new Date("2026-10-14T00:00:00.000Z"),
  guests: 1,
  totalPrice: 100_000,
  nightlyPrice: 50_000,
  cleaningFee: 0,
  currency: "SAR",
  priceBreakdown: null,
  cancellationPolicy: "FLEXIBLE",
  isNonRefundable: false,
  createdAt: new Date("2026-09-30T00:00:00.000Z"),
});
assert.equal(dto.startDate, "2026-10-12", "booking API DTO emits a date-only check-in");
assert.equal(dto.endDate, "2026-10-14", "booking API DTO emits a date-only check-out");

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260930150000_booking_calendar_dates/migration.sql");
const bookingService = read("services/booking.service.ts");
const mapper = read("services/mappers.ts");
const dashboard = read("components/dashboard/reservation-dashboard.tsx");
const reservationCard = read("components/dashboard/reservation-card.tsx");
const bookingDetails = read("components/bookings/booking-stay-info.tsx");
const hostApprovals = read("components/host/host-booking-approvals.tsx");
const hostDetails = read("components/host/host-booking-details-client.tsx");
const guestMessages = read("components/messages/guest-messages-workspace.tsx");
const hostMessages = read("components/host/messages/host-messages-workspace.tsx");
const notifications = read("services/notification.service.ts");

assert.match(schema, /startDate\s+DateTime\s+@db\.Date/);
assert.match(schema, /endDate\s+DateTime\s+@db\.Date/);
assert.match(migration, /INTERVAL '5 hours 30 minutes'/, "known Asia/Kolkata local-midnight rows are repaired");
assert.match(migration, /ALTER COLUMN "startDate" TYPE DATE/);
assert.match(bookingService, /parseBookingDate\(input\.startDate\)/, "booking creation uses UTC calendar dates");
assert.match(mapper, /startDate: bookingDateKey\(b\.startDate\)/, "booking API serialization stays date-only");

for (const [surface, source] of Object.entries({
  dashboard,
  reservationCard,
  bookingDetails,
  hostApprovals,
  hostDetails,
  guestMessages,
  hostMessages,
  notifications,
})) {
  assert.match(source, /bookingDate|formatBookingDate/, `${surface} uses the centralized booking-date contract`);
}

console.log("Booking date consistency and multi-timezone regression checks passed.");
