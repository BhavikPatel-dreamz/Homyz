import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { ProfileManagementClient } from "./profile-management-client";

export default async function ProfileManagementPage() {
  const actor = await requirePageUser();
  const profile = await userService.getById(actor.id);
  const tripPhotos = await userService.getTripPhotos(actor.id);
  const stats = await userService.getUserStats(actor.id);

  return (
    <ProfileManagementClient
      initial={{
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        image: profile.image,
        email: profile.email,
        publicProfile: profile.publicProfile,
      }}
      initialTripPhotos={tripPhotos}
      initialStats={stats}
      isOwner={true}
    />
  );
}
