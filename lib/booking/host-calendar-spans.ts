export type HostCalendarReservationInput = {
  id: string;
  listingId: string;
  status: string;
  startDate: string;
  endDate: string;
};

export type HostCalendarReservationSpan<T extends HostCalendarReservationInput> = {
  booking: T;
  start: string;
  end: string;
  visibleStart: string;
  visibleEnd: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

function calendarKey(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

/**
 * Produces one exclusive-checkout reservation span for each booking/listing
 * pair. The host calendar receives already-normalized calendar-date keys from
 * the workspace service, so no local timezone conversion is needed here.
 */
export function buildHostCalendarReservationSpans<T extends HostCalendarReservationInput>(
  bookings: readonly T[],
  visibleStart: string,
  visibleEnd: string,
  listingIds?: ReadonlySet<string>,
): HostCalendarReservationSpan<T>[] {
  const deduplicated = new Map<string, T>();

  for (const booking of bookings) {
    if (booking.status === "CANCELLED") continue;
    if (listingIds && !listingIds.has(booking.listingId)) continue;

    const start = calendarKey(booking.startDate);
    const end = calendarKey(booking.endDate);
    if (!start || !end || end <= start || end <= visibleStart || start >= visibleEnd) continue;

    // A booking may appear more than once in a response because of joins. A
    // reservation is unique per listing, not per occupied date.
    const key = `${booking.listingId}:${booking.id}`;
    if (!deduplicated.has(key)) deduplicated.set(key, booking);
  }

  return [...deduplicated.values()]
    .map((booking) => {
      const start = calendarKey(booking.startDate);
      const end = calendarKey(booking.endDate);
      return {
        booking,
        start,
        end,
        visibleStart: start < visibleStart ? visibleStart : start,
        visibleEnd: end > visibleEnd ? visibleEnd : end,
        continuesBefore: start < visibleStart,
        continuesAfter: end > visibleEnd,
      };
    })
    .sort((left, right) =>
      left.booking.listingId === right.booking.listingId
        ? left.start.localeCompare(right.start) || left.end.localeCompare(right.end) || left.booking.id.localeCompare(right.booking.id)
        : left.booking.listingId.localeCompare(right.booking.listingId),
    );
}
