import { AdminSettingsForm } from "@/components/admin/admin-settings-form";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getHomepagePopularHomesConfig,
  getHostServiceFeePercentage,
  getNonRefundableDiscountPercentage,
} from "@/services/app-settings.service";

export default async function AdminSettingsPage() {
  await requirePagePermission(PERMISSIONS.SETTINGS_VIEW);
  const initialHostServiceFee = await getHostServiceFeePercentage();
  const initialNonRefundableDiscount = await getNonRefundableDiscountPercentage();
  const initialHomepagePopularHomesConfig = await getHomepagePopularHomesConfig();

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      <div className="border-b border-[var(--border)] pb-5">
        <h1>
          Admin Settings & Platform Controls
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Update administrative password credentials, configure global guest service fees, and review security policies.
        </p>
      </div>

      <AdminSettingsForm
        initialHostServiceFee={initialHostServiceFee}
        initialNonRefundableDiscount={initialNonRefundableDiscount}
        initialHomepagePopularHomesConfig={initialHomepagePopularHomesConfig}
      />
    </div>
  );
}
