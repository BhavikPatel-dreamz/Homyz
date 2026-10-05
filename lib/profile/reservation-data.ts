import type { ReservationCardData } from "@/components/dashboard/reservation-card";
import type { BookingDTO } from "@/services/mappers";
import { computeBookingStatus } from "@/lib/booking/booking-status";
import { bookingDateEpoch } from "@/lib/booking/booking-date";

function calendarDay(date: Date | string): number {
  return bookingDateEpoch(date);
}

function isStayToday(startDate: Date | string, endDate: Date | string): boolean {
  const now = new Date();
  const today = bookingDateEpoch(now);
  return today >= calendarDay(startDate) && today <= calendarDay(endDate);
}

function getActionType(startDate: Date | string, endDate: Date | string): ReservationCardData["actionType"] {
  const now = new Date();
  const today = bookingDateEpoch(now);
  if (today === calendarDay(startDate)) return "check_in";
  if (today === calendarDay(endDate)) return "check_out";
  return "reserved";
}

/** Maps the authenticated guest's actual booking and listing data for trip views. */
export function toReservationCardData(booking: BookingDTO, guestName: string = "Guest"): ReservationCardData {
  const listing = booking.listing;
  const location = [listing?.city, listing?.country]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(", ");

  const breakdown = (booking.priceBreakdown as Record<string, any>) || {};
  const rejection = breakdown.rejection || {};
  const cancellation = breakdown.cancellation || {};

  const statusDetails = computeBookingStatus({
    dbStatus: booking.status,
    startDate: booking.startDate,
    endDate: booking.endDate,
    checkInStart: listing?.checkInStart,
    checkOutTime: listing?.checkOutTime,
    createdAt: booking.createdAt,
    rejectionReason: rejection.reason || cancellation.reason || null,
    rejectionBy: rejection.rejectedBy || cancellation.cancelledBy || null,
    isExpired: Boolean(breakdown.expiredAt || rejection.reason === "EXPIRED"),
  });

  return {
    id: booking.id,
    listingId: booking.listingId,
    listingSlug: listing?.customSlug || null,
    propertyName: listing?.title || "Property stay",
    location: location || "Location unavailable",
    propertyImage: listing?.photos[0] || null,
    startDate: booking.startDate,
    endDate: booking.endDate,
    guestName,
    guestCount: booking.guests,
    status: statusDetails.status,
    checkInTime: listing?.checkInStart || undefined,
    checkOutTime: listing?.checkOutTime || undefined,
    actionType: getActionType(booking.startDate, booking.endDate),
    isToday: isStayToday(booking.startDate, booking.endDate),
    cancellationPolicy: booking.cancellationPolicy,
    isNonRefundable: Boolean(booking.isNonRefundable),
    totalPrice: booking.totalPrice,
    currency: booking.currency,
    createdAt: booking.createdAt,
  };
}
