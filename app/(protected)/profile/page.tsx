import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { bookingService } from "@/services/booking.service";
import { ReservationCardData } from "@/components/dashboard/reservation-card";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const actor = await requirePageUser();
  const user = await userService.getById(actor.id);
  const tripPhotos = await userService.getTripPhotos(actor.id);
  const stats = await userService.getUserStats(actor.id);

  let initialReservations: ReservationCardData[] = [];
  try {
    const { items } = await bookingService.listForUser(actor, {
      skip: 0,
      take: 50,
    });

    initialReservations = items.map((b) => ({
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
  } catch (err) {
    console.error("Failed to load user reservations:", err);
  }

  return (
    <ProfileClient
      initial={user}
      initialTripPhotos={tripPhotos}
      initialStats={stats}
      initialReservations={initialReservations}
      isOwner={true}
    />
  );
}
