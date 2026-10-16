import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getBookingStatusPresentation,
  isUpcomingBookingStatus,
} from "../lib/booking/booking-status";
import { formatBookingDateRange } from "../lib/booking/booking-date";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("services/booking.service.ts");
const loader = read("lib/profile/profile-loader.ts");
const dashboard = read("components/dashboard/reservation-dashboard.tsx");
const card = read("components/dashboard/reservation-card.tsx");
const details = read("components/bookings/booking-details-client.tsx");
const cacheInvalidation = read("lib/redis/invalidation.ts");

assert.equal(isUpcomingBookingStatus("PENDING"), true);
assert.equal(isUpcomingBookingStatus("PENDING_HOST_CONFIRMATION"), true, "external pending alias is supported");
assert.equal(isUpcomingBookingStatus("CONFIRMED"), true);
assert.equal(isUpcomingBookingStatus("CURRENT_STAY"), true);
for (const terminal of ["DECLINED", "EXPIRED", "CANCELLED", "COMPLETED"]) {
  assert.equal(isUpcomingBookingStatus(terminal), false, `${terminal} is excluded from Upcoming`);
}

assert.equal(getBookingStatusPresentation("PENDING").badgeLabel, "Pending host approval");
assert.equal(getBookingStatusPresentation("CONFIRMED").badgeLabel, "Confirmed");
assert.equal(
  formatBookingDateRange("2026-10-12", "2026-10-14"),
  "Oct 12 – Oct 14, 2026",
  "pending and confirmed cards retain canonical calendar dates",
);

assert.match(service, /view\?: "ALL" \| "UPCOMING"/);
assert.match(service, /userId: actor\.id[\s\S]*?endDate: \{ gte: today \}/, "Upcoming query is user-scoped and date-scoped");
assert.match(service, /status: BookingStatus\.CONFIRMED/);
assert.match(service, /status: BookingStatus\.PENDING, createdAt: \{ gt: expiryThreshold \}/);
assert.match(loader, /view:[\s\S]*?"UPCOMING"[\s\S]*?: "ALL"/, "profile loader requests the server-side Upcoming scope");

assert.match(dashboard, /if \(!isUpcomingBookingStatus\(status\)\) return false/);
assert.match(dashboard, /Pending requests \(\{upcomingGroups\.pending\.length\}\)/);
assert.match(dashboard, /Confirmed trips \(\{upcomingGroups\.confirmed\.length\}\)/);
assert.match(dashboard, /item\.status === "PENDING" \|\| item\.status === "PENDING_HOST_CONFIRMATION"/);
assert.match(dashboard, /confirmed: filteredItems\.filter/);
assert.match(dashboard, /grid-cols-1[\s\S]*?sm:grid-cols-2[\s\S]*?lg:grid-cols-3/, "pending and confirmed cards share the responsive grid");
assert.match(card, /getBookingStatusPresentation/);
assert.match(card, /Your host is reviewing this request\./);
assert.match(card, /View details/);
assert.match(details, /BookingStatusTimeline/, "pending cards open the complete booking detail surface");

assert.match(cacheInvalidation, /homyz:bookings:user:\$\{userId\}:\*/, "create/accept/reject/expire invalidates all scoped guest lists");
assert.match(service, /await invalidateBookingCache\(booking\.id, actor\.id, listing\.hostId\)/, "new requests immediately invalidate Upcoming");
assert.match(service, /invalidateBookingCache\(confirmedBooking\.id, confirmedBooking\.userId/, "host acceptance invalidates Upcoming");
assert.match(service, /invalidateBookingCache\(cancelled\.id, cancelled\.userId/, "host rejection invalidates Upcoming");
assert.match(service, /invalidateBookingCache\(expiredBooking\.id, expiredBooking\.userId/, "expiry invalidates Upcoming");

console.log("Upcoming Pending + Confirmed regression checks passed.");
