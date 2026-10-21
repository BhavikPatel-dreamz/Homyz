import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { ReservationDashboard } from "@/components/dashboard/reservation-dashboard";
import { ReservationCardData } from "@/components/dashboard/reservation-card";
import { toReservationCardData } from "@/lib/profile/reservation-data";

export default async function DashboardPage() {
  const user = await requirePageUser();

  // /dashboard is the traveller landing page. Hosts always begin their
  // hosting session in the operational Today workspace instead.
  if (user.role === Role.HOST) {
    redirect("/host/today");
  }

  let initialReservations: ReservationCardData[] = [];

  try {
    const res = await bookingService.listForUser(user, { skip: 0, take: 100 });
    if (res && res.items) {
      initialReservations = res.items.map((booking) => toReservationCardData(booking, user.name || user.email || "Guest"));
    }
  } catch (err) {
    console.error("Error fetching user bookings for dashboard:", err);
  }

  return <ReservationDashboard initialReservations={initialReservations} wideGuestGrid />;
}
