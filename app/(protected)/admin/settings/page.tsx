import { AdminSettingsForm } from "@/components/admin/admin-settings-form";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function AdminSettingsPage() {
  await requirePagePermission(PERMISSIONS.SETTINGS_VIEW);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 ">
          Admin Settings & Security
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Update administrative password credentials, review session policies, and manage operational controls.
        </p>
      </div>

      <AdminSettingsForm />
    </div>
  );
}
