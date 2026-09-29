import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { bookingService } from "@/services/booking.service";
import { reviewService } from "@/services/review.service";
import { notificationService } from "@/services/notification.service";
import { personalInfoService } from "@/services/personal-info.service";
import { toReservationCardData } from "@/lib/profile/reservation-data";
import type { PublicListingDTO } from "@/services/mappers";
import { favoriteService } from "@/services/favorite.service";

export type FavoriteItem = {
  id: string;
  listingId: string;
  createdAt: string;
  listing: PublicListingDTO;
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

export async function loadProfilePageData(tab?: string, subTab?: string) {
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
  const isNotifications = normalizedTab === "notifications";
  const isAccountSettings =
    normalizedTab === "account_settings" ||
    normalizedTab === "personal_info" ||
    normalizedTab === "account";

  // If no tab was specified at all, load all for backwards compatibility
  const shouldLoadAll = tab === undefined;

  const needsTripPhotos =
    shouldLoadAll ||
    (isManagement && (subTab === "photos" || subTab === "trip_photos"));
  const needsStats = shouldLoadAll || isAboutMe;
  const needsReservations = shouldLoadAll || isTrips;
  const needsFavorites = shouldLoadAll || isSaved;
  const needsReviews =
    shouldLoadAll ||
    isAboutMe ||
    normalizedTab === "past_bookings" ||
    normalizedTab === "past";
  const needsNotifications = shouldLoadAll || isNotifications;
  const needsPersonalInfo = shouldLoadAll || isAccountSettings;

  const [
    user,
    stats,
    tripPhotos,
    initialReservations,
    initialFavoritesResult,
    initialReviews,
    initialNotifications,
    initialPersonalInfo,
  ] = await Promise.all([
    userService.getById(actor.id),
    needsStats
      ? userService.getUserStats(actor.id)
      : Promise.resolve({ trips: 0, likes: 0, reviews: 0 }),
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
      ? favoriteService.listUserFavoriteCards(actor.id, { take: 48 }) // queries prisma.listingFavorite.findMany
          .catch((err: unknown) => {
            console.error("Failed to load user favorites:", err);
            return { items: [], total: 0 };
          })
      : Promise.resolve({ items: [], total: 0 }),
    needsReviews
      ? reviewService.getGuestReviews(actor.id).catch((err: unknown) => {
          console.error("Failed to load user reviews:", err);
          return [];
        })
      : Promise.resolve([]),
    needsNotifications
      ? notificationService.listForUser(actor.id, { take: 20 }).catch((err: unknown) => {
          console.error("Failed to load user notifications:", err);
          return { items: [], total: 0, unreadCount: 0 };
        })
      : Promise.resolve({ items: [], total: 0, unreadCount: 0 }),
    needsPersonalInfo
      ? personalInfoService.getPersonalInfo(actor.id).catch((err: unknown) => {
          console.error("Failed to load personal info:", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  return {
    user,
    tripPhotos,
    tripPhotosLoaded: needsTripPhotos,
    stats,
    initialReservations,
    initialFavorites: initialFavoritesResult.items,
    initialFavoritesTotal: initialFavoritesResult.total,
    initialReviews,
    initialNotifications,
    initialPersonalInfo,
  };
}
