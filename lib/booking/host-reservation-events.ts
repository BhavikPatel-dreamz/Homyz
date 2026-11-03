import { formatBookingDateRange } from "@/lib/booking/booking-date";
import { formatTime12h, parseTimeMinutes } from "@/lib/booking/booking-time";
import { propertyDateKey } from "@/lib/booking/property-timezone";
import type { HostReservation } from "@/components/host/host-workspace-shared";
import type { ListingDTO } from "@/services/mappers";

export type ReservationPeriod =
  | "today"
  | "upcoming"
  | "staying"
  | "completed"
  | "pending"
  | "cancelled"
  | "all";

export type HostOperationalListing =
  | ListingDTO
  | NonNullable<HostReservation["listing"]>;

export type OperationalEvent = {
  /** A booking can produce more than one operational event on the same day. */
  id: string;
  booking: HostReservation;
  listing: HostOperationalListing;
  eventType: "checkout" | "checkin" | "staying" | "upcoming" | "completed" | "pending" | "cancelled";
  timeDisplay: string;
  subtitleDisplay: string;
  dateDisplay?: string;
  timeMinutes: number;
};

export function deduplicateHostReservations(
  reservations: HostReservation[],
): HostReservation[] {
  const byId = new Map<string, HostReservation>();
  for (const reservation of reservations) {
    byId.set(reservation.id, reservation);
  }
  return Array.from(byId.values());
}

export function buildOperationalEvents(
  bookings: HostReservation[],
  listingsById: ReadonlyMap<string, ListingDTO>,
  period: ReservationPeriod,
  today: string | Date,
): OperationalEvent[] {
  const events: OperationalEvent[] = [];

  for (const booking of bookings) {
    const localToday = today instanceof Date
      ? propertyDateKey(today, booking.propertyTimeZone)
      : today;
    const listing: HostOperationalListing = listingsById.get(booking.listingId)
      ?? booking.listing
      ?? {
        id: booking.listingId,
        title: "Listing",
        city: "",
        district: "",
        country: "Saudi Arabia",
        photos: [],
        checkInStart: "15:00",
        checkOutTime: "11:00",
      };

    if (period === "today") {
      if (booking.status !== "CONFIRMED" && booking.status !== "PENDING") continue;
      if (booking.endDate === localToday) {
        events.push({
          id: `${booking.id}:checkout`,
          booking,
          listing,
          eventType: "checkout",
          timeMinutes: parseTimeMinutes(booking.checkOutTime ?? listing.checkOutTime, 11 * 60),
          timeDisplay: formatTime12h(booking.checkOutTime ?? listing.checkOutTime, "11:00 AM"),
          subtitleDisplay: `${booking.guestName || "Guest"} checks out`,
        });
      }
      if (booking.startDate === localToday) {
        events.push({
          id: `${booking.id}:checkin`,
          booking,
          listing,
          eventType: "checkin",
          timeMinutes: parseTimeMinutes(booking.checkInTime ?? listing.checkInStart, 15 * 60),
          timeDisplay: formatTime12h(booking.checkInTime ?? listing.checkInStart, "3:00 PM"),
          subtitleDisplay: `${booking.guestName || "Guest"} checks in`,
        });
      } else if (booking.startDate < localToday && booking.endDate > localToday) {
        events.push({
          id: `${booking.id}:staying`,
          booking,
          listing,
          eventType: "staying",
          timeMinutes: 12 * 60,
          timeDisplay: formatTime12h(booking.checkOutTime ?? listing.checkOutTime, "11:00 AM"),
          subtitleDisplay: `Currently hosting ${booking.guestName || "Guest"}`,
        });
      }
    } else if (period === "upcoming") {
      if (booking.status !== "CONFIRMED" && booking.status !== "PENDING") continue;
      if (booking.startDate > localToday) {
        events.push({
          id: `${booking.id}:upcoming`,
          booking,
          listing,
          eventType: "upcoming",
          timeMinutes: parseTimeMinutes(booking.checkInTime ?? listing.checkInStart, 15 * 60),
          timeDisplay: formatTime12h(booking.checkInTime ?? listing.checkInStart, "3:00 PM"),
          subtitleDisplay: `${booking.guestName || "Guest"} checks in`,
          dateDisplay: formatBookingDateRange(booking.startDate, booking.endDate),
        });
      }
    } else if (period === "staying") {
      if (booking.status === "CONFIRMED" && booking.startDate <= localToday && booking.endDate > localToday) {
        events.push({
          id: `${booking.id}:staying`,
          booking,
          listing,
          eventType: "staying",
          timeMinutes: 12 * 60,
          timeDisplay: formatTime12h(listing.checkOutTime, "11:00 AM"),
          subtitleDisplay: `Currently hosting ${booking.guestName || "Guest"}`,
          dateDisplay: formatBookingDateRange(booking.startDate, booking.endDate),
        });
      }
    } else if (period === "completed") {
      if (booking.status === "CONFIRMED" && booking.endDate <= localToday) {
        events.push({
          id: `${booking.id}:completed`,
          booking,
          listing,
          eventType: "completed",
          timeMinutes: 11 * 60,
          timeDisplay: "Completed",
          subtitleDisplay: `${booking.guestName || "Guest"} completed stay`,
          dateDisplay: formatBookingDateRange(booking.startDate, booking.endDate),
        });
      }
    } else if (period === "pending") {
      if (booking.status === "PENDING") {
        events.push({
          id: `${booking.id}:pending`,
          booking,
          listing,
          eventType: "pending",
          timeMinutes: parseTimeMinutes(listing.checkInStart, 15 * 60),
          timeDisplay: "Pending approval",
          subtitleDisplay: `${booking.guestName || "Guest"} requested stay`,
          dateDisplay: formatBookingDateRange(booking.startDate, booking.endDate),
        });
      }
    } else if (period === "cancelled") {
      if (booking.status === "CANCELLED") {
        events.push({
          id: `${booking.id}:cancelled`,
          booking,
          listing,
          eventType: "cancelled",
          timeMinutes: 0,
          timeDisplay: "Cancelled",
          subtitleDisplay: `${booking.guestName || "Guest"}'s reservation cancelled`,
          dateDisplay: formatBookingDateRange(booking.startDate, booking.endDate),
        });
      }
    } else if (period === "all") {
      const isCancelled = booking.status === "CANCELLED";
      const isPending = booking.status === "PENDING";
      const isCompleted = booking.status === "CONFIRMED" && booking.endDate <= localToday;
      const isStaying = booking.status === "CONFIRMED" && booking.startDate <= localToday && booking.endDate > localToday;

      const eventType = isCancelled
        ? "cancelled"
        : isPending
        ? "pending"
        : isCompleted
        ? "completed"
        : isStaying
        ? "staying"
        : "upcoming";

      const timeDisplay = isCancelled
        ? "Cancelled"
        : isPending
        ? "Pending"
        : isCompleted
        ? "Completed"
        : formatTime12h(booking.checkInTime ?? listing.checkInStart, "3:00 PM");

      events.push({
        id: `${booking.id}:${eventType}`,
        booking,
        listing,
        eventType,
        timeMinutes: parseTimeMinutes(booking.checkInTime ?? listing.checkInStart, 15 * 60),
        timeDisplay,
        subtitleDisplay: `${booking.guestName || "Guest"} · ${booking.status}`,
        dateDisplay: formatBookingDateRange(booking.startDate, booking.endDate),
      });
    }
  }

  if (period === "today") {
    return events.sort(
      (left, right) =>
        left.timeMinutes - right.timeMinutes
        || left.booking.id.localeCompare(right.booking.id),
    );
  }

  if (period === "completed" || period === "all" || period === "cancelled") {
    return events.sort((left, right) => {
      const dateDifference = right.booking.startDate.localeCompare(left.booking.startDate);
      if (dateDifference !== 0) return dateDifference;
      return left.booking.id.localeCompare(right.booking.id);
    });
  }

  return events.sort((left, right) => {
    const dateDifference = left.booking.startDate.localeCompare(right.booking.startDate);
    if (dateDifference !== 0) return dateDifference;
    return left.timeMinutes - right.timeMinutes
      || left.booking.id.localeCompare(right.booking.id);
  });
}

export function selectPriorityReservationId(
  visibleEvents: OperationalEvent[],
  period: ReservationPeriod,
  currentTimeMinutes: number,
): string | null {
  if (visibleEvents.length === 0) return null;
  if (period === "upcoming") return visibleEvents[0].id;

  const activeStay = visibleEvents.find((event) => event.eventType === "staying");
  if (activeStay) return activeStay.id;

  const nextEvent = visibleEvents.find(
    (event) => event.timeMinutes >= currentTimeMinutes,
  );
  return (nextEvent ?? visibleEvents[0]).id;
}

export function filterOperationalEventsByProperty(
  events: OperationalEvent[],
  propertyId: string | null,
): OperationalEvent[] {
  if (!propertyId) return events;
  return events.filter((event) => event.booking.listingId === propertyId);
}
