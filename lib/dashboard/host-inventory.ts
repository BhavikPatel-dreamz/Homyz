import { BookingStatus } from "@/generated/prisma/enums";
import { bookingDateKey, parseBookingDate } from "@/lib/booking/booking-date";

export type DashboardInventoryListing = { id: string; blockedDates: string[] };
export type DashboardInventoryBooking = { listingId: string; status: BookingStatus; startDate: Date; endDate: Date };
export type DashboardInventoryDatePoint = { dateKey: string; blockedNights: number; bookedNights: number; bookableNights: number; availableNights: number; ratePercentage: number | null; reservationCount: number };

/**
 * Canonical Host Dashboard inventory policy: confirmed reservation nights take
 * precedence over manual blocks; blocks are excluded from bookable inventory.
 */
export function calculateDashboardInventoryByDate({ listings, bookings, startDateKey, endDateKeyExclusive }: { listings: DashboardInventoryListing[]; bookings: DashboardInventoryBooking[]; startDateKey: string; endDateKeyExclusive: string }): DashboardInventoryDatePoint[] {
  const dateKeys: string[] = [];
  for (let cursor = parseBookingDate(startDateKey); bookingDateKey(cursor) < endDateKeyExclusive; cursor.setUTCDate(cursor.getUTCDate() + 1)) dateKeys.push(bookingDateKey(cursor));
  const listingIds = new Set(listings.map((listing) => listing.id));
  const blocked = new Set<string>(); const booked = new Set<string>(); const reservationsByDate = new Map<string, Set<string>>();
  for (const listing of listings) for (const dateKey of listing.blockedDates || []) if (dateKey >= startDateKey && dateKey < endDateKeyExclusive) blocked.add(`${listing.id}_${dateKey}`);
  for (const booking of bookings) {
    if (booking.status !== BookingStatus.CONFIRMED || !listingIds.has(booking.listingId)) continue;
    for (let cursor = parseBookingDate(booking.startDate); bookingDateKey(cursor) < bookingDateKey(booking.endDate); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const dateKey = bookingDateKey(cursor);
      if (dateKey < startDateKey || dateKey >= endDateKeyExclusive) continue;
      booked.add(`${booking.listingId}_${dateKey}`);
      const ids = reservationsByDate.get(dateKey) ?? new Set<string>();
      ids.add(`${booking.listingId}_${bookingDateKey(booking.startDate)}_${bookingDateKey(booking.endDate)}`);
      reservationsByDate.set(dateKey, ids);
    }
  }
  return dateKeys.map((dateKey) => {
    let blockedNights = 0; let bookedNights = 0;
    for (const listing of listings) { const key = `${listing.id}_${dateKey}`; if (booked.has(key)) bookedNights++; else if (blocked.has(key)) blockedNights++; }
    const bookableNights = Math.max(0, listings.length - blockedNights); const availableNights = Math.max(0, bookableNights - bookedNights);
    return { dateKey, blockedNights, bookedNights, bookableNights, availableNights, ratePercentage: bookableNights ? Math.round((bookedNights / bookableNights) * 1000) / 10 : null, reservationCount: reservationsByDate.get(dateKey)?.size ?? 0 };
  });
}

export function calculateDashboardInventory(input: { listings: DashboardInventoryListing[]; bookings: DashboardInventoryBooking[]; startDateKey: string; endDateKeyExclusive: string }) {
  const points = calculateDashboardInventoryByDate(input);
  const blockedNights = points.reduce((sum, point) => sum + point.blockedNights, 0);
  const bookedNights = points.reduce((sum, point) => sum + point.bookedNights, 0);
  const bookableNights = points.reduce((sum, point) => sum + point.bookableNights, 0);
  const availableNights = points.reduce((sum, point) => sum + point.availableNights, 0);
  return { blockedNights, bookedNights, bookableNights, availableNights, ratePercentage: bookableNights > 0 ? Math.min(100, Math.round((bookedNights / bookableNights) * 1000) / 10) : 0 };
}
