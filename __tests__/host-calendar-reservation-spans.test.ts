import assert from "node:assert/strict";
import test from "node:test";
import { buildHostCalendarReservationSpans } from "../lib/booking/host-calendar-spans";

const booking = {
  id: "booking-1",
  listingId: "listing-a",
  status: "CONFIRMED",
  startDate: "2026-10-08",
  endDate: "2026-10-10",
};

test("host calendar deduplicates a reservation and keeps checkout exclusive", () => {
  const spans = buildHostCalendarReservationSpans(
    [booking, { ...booking }],
    "2026-10-01",
    "2026-11-01",
  );

  assert.equal(spans.length, 1);
  assert.deepEqual(
    { start: spans[0].start, end: spans[0].end, visibleStart: spans[0].visibleStart, visibleEnd: spans[0].visibleEnd },
    { start: "2026-10-08", end: "2026-10-10", visibleStart: "2026-10-08", visibleEnd: "2026-10-10" },
  );
});

test("host calendar keeps back-to-back stays separate and excludes cancelled stays", () => {
  const spans = buildHostCalendarReservationSpans(
    [
      booking,
      { ...booking, id: "booking-2", startDate: "2026-10-10", endDate: "2026-10-12" },
      { ...booking, id: "booking-cancelled", status: "CANCELLED" },
    ],
    "2026-10-01",
    "2026-11-01",
  );

  assert.deepEqual(spans.map((span) => [span.booking.id, span.start, span.end]), [
    ["booking-1", "2026-10-08", "2026-10-10"],
    ["booking-2", "2026-10-10", "2026-10-12"],
  ]);
});

test("host calendar marks bookings that continue beyond the visible date range", () => {
  const [span] = buildHostCalendarReservationSpans(
    [{ ...booking, startDate: "2026-09-28", endDate: "2026-11-03" }],
    "2026-10-01",
    "2026-11-01",
  );

  assert.equal(span.continuesBefore, true);
  assert.equal(span.continuesAfter, true);
  assert.equal(span.visibleStart, "2026-10-01");
  assert.equal(span.visibleEnd, "2026-11-01");
});
