import type { Metadata } from "next";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { getOrCreateTravelProfile } from "@/services/travel-profile.service";
import { userService } from "@/services/user.service";
import { travelSocialLikesService } from "@/services/travel-social-likes.service";
import { GuestTravelProfileView } from "@/components/travel/guest-travel-profile-view";

export const metadata: Metadata = {
  title: "My Travel Profile | Homyz",
  description: "View and manage your travel diary, photos, visited destinations, and stamps.",
};

export const dynamic = "force-dynamic";

export default async function TravelProfilePage() {
  const user = await requirePageUser();

  const [profile, baseStats, receivedLikes] = await Promise.all([
    getOrCreateTravelProfile(user.id).catch(() => null),
    userService.getUserStats(user.id).catch(() => ({ trips: 0, reviews: 0 })),
    travelSocialLikesService.getTotalReceivedLikes(user.id).catch(() => 0),
  ]);

  const stats = {
    trips: baseStats.trips,
    likes: receivedLikes,
    reviews: baseStats.reviews,
    likesSupported: true,
  };

  return (
    <div className="w-full min-h-screen py-4 sm:py-6">
      <GuestTravelProfileView
        user={{
          id: user.id,
          name: user.name ?? null,
          image: user.image ?? null,
          email: user.email ?? null,
          role: user.role,
        }}
        initialProfile={profile}
        initialStats={stats}
        isOwner={true}
      />
    </div>
  );
}

