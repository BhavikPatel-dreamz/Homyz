import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const actor = await requirePageUser();
  const user = await userService.getById(actor.id);
  const tripPhotos = await userService.getTripPhotos(actor.id);
  const stats = await userService.getUserStats(actor.id);

  return (
    <ProfileClient
      initial={user}
      initialTripPhotos={tripPhotos}
      initialStats={stats}
      isOwner={true}
    />
  );
}
