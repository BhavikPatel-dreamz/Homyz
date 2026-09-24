import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { bookingService } from "@/services/booking.service";
import { reviewService } from "@/services/review.service";
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

export type GuestAuthoredReviewDTO = {
  id: string;
  listingId: string;
  bookingId: string | null;
  rating: number;
  comment: string;
  topics: string[];
  createdAt: string;
  listing?: {
    id: string;
    title: string;
    photos: string[];
    city: string | null;
    country: string | null;
    customSlug: string | null;
  } | null;
  booking?: {
    id: string;
    startDate: string;
    endDate: string;
  } | null;
};

export async function loadProfilePageData(tab?: string) {
  const actor = await requirePageUser();
  const normalizedTab = tab?.toLowerCase();

  // If tab is specified, determine what this section actually needs (Lazy loading / per-section data)
  const isAboutMe = !normalizedTab || normalizedTab === "about_me";
  const isTrips =
    normalizedTab === "upcoming_trips" ||
    normalizedTab === "upcoming" ||
    normalizedTab === "past_bookings" ||
    normalizedTab === "past" ||
    normalizedTab === "today";
  const isSaved = normalizedTab === "saved";
  const isManagement = normalizedTab === "profile_management";

  // If no tab was specified at all, load all for backwards compatibility
  const shouldLoadAll = tab === undefined;

  const needsTripPhotos = shouldLoadAll || isAboutMe || isManagement;
  const needsReservations = shouldLoadAll || isTrips;
  const needsFavorites = shouldLoadAll || isSaved;
  const needsReviews =
    shouldLoadAll ||
    isAboutMe ||
    normalizedTab === "past_bookings" ||
    normalizedTab === "past";

  const [
    user,
    stats,
    tripPhotos,
    initialReservations,
    initialFavorites,
    initialReviews,
  ] = await Promise.all([
    userService.getById(actor.id),
    userService.getUserStats(actor.id),
    needsTripPhotos
      ? userService.getTripPhotos(actor.id).catch(() => [])
      : Promise.resolve([]),
    needsReservations
      ? bookingService
          .listForUser(actor, { skip: 0, take: 50 })
          .then(({ items }) =>
            items.map((booking) =>
              toReservationCardData(
                booking,
                actor.name || actor.email || "Guest",
              ),
            ),
          )
          .catch((err: unknown) => {
            console.error("Failed to load user reservations:", err);
            return [];
          })
      : Promise.resolve([]),
    needsFavorites
      ? prisma.listingFavorite.findMany({
            where: { userId: actor.id },
            orderBy: { createdAt: "desc" },
            include: { listing: { select: publicListingCardSelect } },
          })
          .then((favorites: any[]) =>
            favorites
              .map((f: any) => ({
                id: f.id,
                listingId: f.listingId,
                createdAt: f.createdAt.toISOString(),
                listing: f.listing ? toPublicListingCardDTO(f.listing) : null,
              }))
              .filter((x: any) => x.listing !== null),
          )
          .catch((err: unknown) => {
            console.error("Failed to load user favorites:", err);
            return [];
          })
      : Promise.resolve([]),
    needsReviews
      ? reviewService.getGuestReviews(actor.id).catch((err: unknown) => {
          console.error("Failed to load user reviews:", err);
          return [];
        })
      : Promise.resolve([]),
  ]);

  return {
    user,
    tripPhotos,
    stats,
    initialReservations,
    initialFavorites,
    initialReviews,
  };
}

