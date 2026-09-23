import type { ReservationCardData } from "@/components/dashboard/reservation-card";
import type { BookingDTO } from "@/services/mappers";

function calendarDay(date: Date | string): number {
  const value = new Date(date);
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function isStayToday(startDate: Date | string, endDate: Date | string): boolean {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return today >= calendarDay(startDate) && today <= calendarDay(endDate);
}

function getActionType(startDate: Date | string, endDate: Date | string): ReservationCardData["actionType"] {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (today === calendarDay(startDate)) return "check_in";
  if (today === calendarDay(endDate)) return "check_out";
  return "reserved";
}

/** Maps the authenticated guest's actual booking and listing data for trip views. */
export function toReservationCardData(booking: BookingDTO, guestName: string): ReservationCardData {
  const listing = booking.listing;
  const location = [listing?.city, listing?.country]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(", ");

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
    status: booking.status,
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
