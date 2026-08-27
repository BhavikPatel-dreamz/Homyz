import { AdminSettingsForm } from "@/components/admin/admin-settings-form";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function AdminSettingsPage() {
  await requirePagePermission(PERMISSIONS.SETTINGS_VIEW);

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Admin Settings & Security
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Update administrative password credentials, review session policies, and manage operational controls.
        </p>
      </div>

      <AdminSettingsForm />
    </div>
  );
}
