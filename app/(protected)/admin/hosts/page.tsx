import { requirePageRole, requirePagePermission } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { HostPhase1Dashboard } from "@/components/admin/host-phase1-dashboard";

export const metadata = {
  title: "Host Management | Homyz Admin",
  description: "Unified administrative host management dashboard, onboarding lifecycle, and host registry.",
};

export default async function AdminHostManagementPage() {
  await requirePageRole([Role.ADMIN]);
  await requirePagePermission(PERMISSIONS.HOSTS_VIEW);

  const result = await adminService.listUnifiedHosts({ take: 500 });

  return (
    <div className="w-full">
      <HostPhase1Dashboard
        analytics={result.analytics}
        initialHosts={result.items}
      />
    </div>
  );
}
