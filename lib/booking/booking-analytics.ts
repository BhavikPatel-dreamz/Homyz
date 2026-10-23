import { bookingDateKey, differenceInBookingNights, type BookingDateInput } from "@/lib/booking/booking-date";

/** One approved definition for every Phase 14 last-minute metric. */
export const LAST_MINUTE_LEAD_DAYS = 3;

/**
 * Calendar-day lead time because reservations store check-in as a DATE, not a
 * check-in timestamp. A booking created on the check-in calendar day is 0.
 */
export function calculateBookingLeadTimeDays(createdAt: Date, checkInDate: BookingDateInput) {
  return differenceInBookingNights(bookingDateKey(createdAt), checkInDate);
}

export function isLastMinuteBooking(leadTimeDays: number) {
  return leadTimeDays >= 0 && leadTimeDays <= LAST_MINUTE_LEAD_DAYS;
}

export function calculateWeightedOccupancy(bookedNights: number, bookableNights: number) {
  if (bookableNights <= 0) return null;
  return Math.round((bookedNights / bookableNights) * 1000) / 10;
}
