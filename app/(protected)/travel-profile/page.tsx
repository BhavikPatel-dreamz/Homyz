import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import {
  getTravelProfileByUserId,
  getTravelProfileStats,
} from "@/services/travel-profile.service";
import {
  getPaginatedTravelPhotos,
  getCountryHighlights,
} from "@/services/travel-photo.service";
import { getPaginatedTravelerStamps } from "@/services/travel-stamp.service";
import { getTravelerDestinationStats } from "@/services/travel-destination.service";
import { TravelProfileView } from "@/components/travel/travel-profile-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "My Travel Profile — Homyz",
  description:
    "View and manage your travel diary, completed trips, and traveler highlights.",
};

export default async function TravelProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?callbackUrl=/travel-profile");
  }

  const [
    profile,
    stats,
    photosResult,
    highlights,
    stampsResult,
    destinationStats,
  ] = await Promise.all([
    getTravelProfileByUserId(user.id),
    getTravelProfileStats(user.id),
    getPaginatedTravelPhotos({ userId: user.id, actorId: user.id, limit: 20 }),
    getCountryHighlights(user.id, { actorId: user.id }),
    getPaginatedTravelerStamps(user.id, { limit: 12 }),
    getTravelerDestinationStats(user.id),
  ]);

  // The protected shell owns the page chrome (header, main element, and footer).
  // Rendering it here too caused the duplicated header/footer shown on this page.
  return (
    <TravelProfileView
      key={`${profile.updatedAt}-${photosResult.totalCount}`}
      initialProfile={profile}
      initialStats={stats}
      initialPhotos={photosResult.items}
      initialPhotosNextCursor={photosResult.nextCursor}
      initialHighlights={highlights}
      initialStamps={stampsResult.items}
      initialStampsNextCursor={stampsResult.nextCursor}
      initialStampsTotalCount={stampsResult.totalCount}
      initialDestinationStats={destinationStats}
      isOwner={true}
    />
  );
}
