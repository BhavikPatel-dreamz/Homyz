import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { ReservationDashboard } from "@/components/dashboard/reservation-dashboard";
import { ReservationCardData } from "@/components/dashboard/reservation-card";

export default async function BookingsPage() {
  const actor = await requirePageUser();
  const { items } = await bookingService.listForUser(actor, {
    skip: 0,
    take: 50,
  });

  const formattedBookings: ReservationCardData[] = items.map((b) => ({
    id: b.id,
    propertyName: b.listing?.title || "Luxury Villa Stay",
    location: "Malibu Beach, CA",
    propertyImage: null,
    startDate: b.startDate,
    endDate: b.endDate,
    guestName: actor.name || actor.email || "Guest",
    guestCount: 2,
    status: b.status,
    checkInTime: "3:00 PM",
    actionType: "check_in",
    isToday: false,
  }));

  return <ReservationDashboard initialReservations={formattedBookings} />;
}
