import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { userService } from "@/services/user.service";
import { ProfileClient } from "@/app/(protected)/profile/profile-client";

async function loadPublicProfile(id: string) {
  const user = await userService.getById(id);
  if (user.publicProfile?.profileVisible === false) notFound();
  const [tripPhotos, stats] = await Promise.all([
    userService.getTripPhotos(id),
    userService.getUserStats(id),
  ]);

  return {
    initial: {
      id: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      publicProfile: user.publicProfile,
      email: null,
      phone: null,
    },
    tripPhotos,
    stats,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionUser = await getSessionUser();

  // Redirect to owner profile page if viewing own profile via public ID URL
  if (sessionUser?.id === id) {
    redirect("/profile");
  }

  const profile = await loadPublicProfile(id).catch(() => notFound());

  return (
    <ProfileClient
      initial={profile.initial}
      initialTripPhotos={profile.tripPhotos}
      initialStats={profile.stats}
      isOwner={false}
    />
  );
}
