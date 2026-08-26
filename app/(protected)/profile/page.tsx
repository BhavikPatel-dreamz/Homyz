import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { ProfileForm } from "@/components/forms/profile-form";
import { Card } from "@/components/ui";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { userService } from "@/services/user.service";

export default async function ProfilePage() {
  const actor = await requirePageUser();
  const user = await userService.getById(actor.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Profile
      </h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium text-zinc-900 dark:text-zinc-50">
            Your details
          </h2>
          <ProfileForm
            initial={{ name: user.name, phone: user.phone, image: user.image }}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-medium text-zinc-900 dark:text-zinc-50">
            Change password
          </h2>
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}
