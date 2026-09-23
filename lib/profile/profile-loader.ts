import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { bookingService } from "@/services/booking.service";
import { ReservationCardData } from "@/components/dashboard/reservation-card";
import { toReservationCardData } from "@/lib/profile/reservation-data";
import { prisma } from "@/lib/db/prisma";
import { publicListingCardSelect, toPublicListingCardDTO, type PublicListingDTO } from "@/services/mappers";

export type FavoriteItem = {
  id: string;
  listingId: string;
  createdAt: string;
  listing: PublicListingDTO | any;
};

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

  let initialFavorites: FavoriteItem[] = [];
  try {
    const favorites = await prisma.listingFavorite.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      include: { listing: { select: publicListingCardSelect } },
    });
    initialFavorites = favorites
      .map((f: any) => ({
        id: f.id,
        listingId: f.listingId,
        createdAt: f.createdAt.toISOString(),
        listing: f.listing ? toPublicListingCardDTO(f.listing) : null,
      }))
      .filter((x: any) => x.listing !== null);
  } catch (err) {
    console.error("Failed to load user favorites:", err);
  }

  return {
    user,
    tripPhotos,
    stats,
    initialReservations,
    initialFavorites,
  };
}

