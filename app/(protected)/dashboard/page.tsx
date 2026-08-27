import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { ReservationDashboard } from "@/components/dashboard/reservation-dashboard";
import { ReservationCardData } from "@/components/dashboard/reservation-card";

export default async function DashboardPage() {
  const user = await requirePageUser();

  let initialReservations: ReservationCardData[] = [];

  try {
    const res = await bookingService.listForUser(user, { skip: 0, take: 20 });
    if (res && res.items) {
      initialReservations = res.items.map((b) => ({
        id: b.id,
        propertyName: b.listing?.title || "Property Stay",
        location: "Malibu, Beachfront",
        propertyImage: null,
        startDate: b.startDate,
        endDate: b.endDate,
        guestName: user.name || user.email || "Guest",
        guestCount: 2,
        status: b.status,
        checkInTime: "3:00 PM",
        actionType: "check_in",
        isToday: false,
      }));
    }
  } catch (err) {
    console.error("Error fetching user bookings for dashboard:", err);
  }

  return <ReservationDashboard initialReservations={initialReservations} />;
}
