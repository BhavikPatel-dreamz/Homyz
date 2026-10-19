import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isCompletedConfirmedBooking } from "../lib/booking/booking-status";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function testCompletedStayEligibility() {
  const now = new Date("2026-10-19T12:00:00.000Z");

  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: "CONFIRMED",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
      checkOutTime: "11:00",
      now,
    }),
    true,
    "a confirmed booking counts only after checkout",
  );
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: "PENDING",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
      checkOutTime: "11:00",
      now,
    }),
    false,
    "pending bookings never count as trips",
  );
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: "CANCELLED",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
      checkOutTime: "11:00",
      now,
    }),
    false,
    "cancelled bookings never count as trips",
  );
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: "CONFIRMED",
      startDate: "2026-10-19",
      endDate: "2026-10-20",
      checkOutTime: "11:00",
      now,
    }),
    false,
    "future confirmed bookings do not count as trips",
  );
}

function testLegacyProfileBoundaries() {
  const action = source("actions/user/tripPhotos.ts");
  assert.match(
    action,
    /export async function getTripPhotosAction\(\)/,
    "owner gallery action must not accept an arbitrary target user",
  );
  assert.doesNotMatch(action, /targetUserId/, "owner gallery action must not use targetUserId");

  const publicPage = source("app/profile/[id]/page.tsx");
  assert.match(
    publicPage,
    /userService\.getLegacyPublicProfile\(id\)/,
    "legacy public page must use the allow-listed projection",
  );
  assert.doesNotMatch(
    publicPage,
    /getTripPhotos\(/,
    "legacy public page must not expose historical TripPhoto records",
  );

  const userService = source("services/user.service.ts");
  assert.match(userService, /select:\s*\{[\s\S]*?publicProfile: true/, "legacy query must use an explicit select");
  assert.match(userService, /profile\.profileVisible !== true/, "legacy public visibility must fail closed");
  assert.match(userService, /direction: ReviewDirection\.GUEST_TO_PROPERTY/, "review counter must use guest-authored reviews only");
  assert.match(userService, /likesSupported: false/, "likes must remain explicitly unsupported");

  const proxy = source("proxy.ts");
  assert.match(proxy, /"\/profile\/tab\/:path\*"/, "profile management remains protected");
  assert.doesNotMatch(proxy, /"\/profile\/:path\*"/, "legacy public profile route must not be proxy-login gated");
}

testCompletedStayEligibility();
testLegacyProfileBoundaries();
console.log("Phase 1 travel-profile security checks passed.");
