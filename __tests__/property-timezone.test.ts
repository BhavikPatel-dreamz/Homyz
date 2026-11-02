import assert from "node:assert/strict";
import test from "node:test";
import { differenceInBookingNights } from "../lib/booking/booking-date";
import {
  propertyDateKey,
  propertyLocalDateTimeToUtc,
  resolvePropertyTimeZone,
} from "../lib/booking/property-timezone";

test("uses the property's Riyadh clock rather than the guest or server timezone", () => {
  assert.equal(resolvePropertyTimeZone({ city: "Riyadh", country: "Saudi Arabia - SA" }), "Asia/Riyadh");
  assert.equal(
    propertyLocalDateTimeToUtc("2026-11-02", "15:00", "Asia/Riyadh", 15).toISOString(),
    "2026-11-02T12:00:00.000Z",
  );
});

test("handles a cross-country stay and property-local day boundaries", () => {
  assert.equal(
    propertyLocalDateTimeToUtc("2026-11-02", "15:00", "Asia/Kolkata", 15).toISOString(),
    "2026-11-02T09:30:00.000Z",
  );
  assert.equal(propertyDateKey(new Date("2026-11-01T21:30:00.000Z"), "Asia/Riyadh"), "2026-11-02");
});

test("uses the local DST offset and keeps date-only stays checkout-exclusive", () => {
  assert.equal(
    propertyLocalDateTimeToUtc("2026-11-02", "15:00", "America/New_York", 15).toISOString(),
    "2026-11-02T20:00:00.000Z",
  );
  assert.equal(differenceInBookingNights("2026-10-31", "2026-11-02"), 2);
});
