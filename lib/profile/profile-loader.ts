import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { bookingService } from "@/services/booking.service";
import { ReservationCardData } from "@/components/dashboard/reservation-card";
import { toReservationCardData } from "@/lib/profile/reservation-data";

export async function loadProfilePageData() {
  const actor = await requirePageUser();
  const user = await userService.getById(actor.id);
  const tripPhotos = await userService.getTripPhotos(actor.id);
  const stats = await userService.getUserStats(actor.id);

  let initialReservations: ReservationCardData[] = [];
  try {
    const { items } = await bookingService.listForUser(actor, {
      skip: 0,
      take: 100,
    });

    initialReservations = items.map((booking) => toReservationCardData(booking, actor.name || actor.email || "Guest"));
  } catch (err) {
    console.error("Failed to load user reservations:", err);
  }

  return {
    user,
    tripPhotos,
    stats,
    initialReservations,
  };
}
