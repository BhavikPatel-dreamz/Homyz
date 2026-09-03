import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { userService } from "@/services/user.service";
import { ProfileClient } from "@/app/(protected)/profile/profile-client";

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

  try {
    const user = await userService.getById(id);
    const tripPhotos = await userService.getTripPhotos(id);
    const stats = await userService.getUserStats(id);

    return (
      <ProfileClient
        initial={user}
        initialTripPhotos={tripPhotos}
        initialStats={stats}
        isOwner={false}
      />
    );
  } catch {
    notFound();
  }
}
