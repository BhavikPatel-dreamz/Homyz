import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const actor = await requirePageUser();
  const user = await userService.getById(actor.id);

  return <ProfileClient initial={user} />;
}
