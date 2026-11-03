import assert from "node:assert/strict";
import test from "node:test";
import { getCalendarWeeks, getWeekBookingSegments } from "../lib/booking/calendar-week-layout";

const booking = { id: "stay-1" };

test("week booking bars use checkout-exclusive columns and remain continuous within a row", () => {
  const week = getCalendarWeeks(new Date(2026, 9, 1))[1]; // Oct 4–10
  const [segment] = getWeekBookingSegments(week, [
    { booking, start: "2026-10-06", end: "2026-10-10" },
  ]);

  assert.deepEqual(
    { startColumn: segment.startColumn, endColumn: segment.endColumn, continuesBefore: segment.continuesBefore, continuesAfter: segment.continuesAfter },
    { startColumn: 3, endColumn: 7, continuesBefore: false, continuesAfter: false },
  );
});

test("week booking bars split at week boundaries and place overlaps in separate lanes", () => {
  const week = getCalendarWeeks(new Date(2026, 9, 1))[1]; // Oct 4–10
  const segments = getWeekBookingSegments(week, [
    { booking: { id: "crossing" }, start: "2026-10-02", end: "2026-10-12" },
    { booking: { id: "overlap" }, start: "2026-10-07", end: "2026-10-09" },
  ]);

  assert.deepEqual(
    segments.map((segment) => [segment.booking.id, segment.startColumn, segment.endColumn, segment.lane, segment.continuesBefore, segment.continuesAfter]),
    [
      ["crossing", 1, 8, 0, true, true],
      ["overlap", 4, 6, 1, false, false],
    ],
  );
});
