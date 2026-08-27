import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { adminService } from "@/services/admin.service";
import { HostPhase1Dashboard } from "@/components/admin/host-phase1-dashboard";

export const metadata = {
  title: "Host Management — Phase 1 Analytics | Homyz Admin",
  description: "Administrative host management dashboard, growth analytics, and host registry.",
};

export default async function AdminHostManagementPage() {
  await requirePageRole([Role.ADMIN]);

  const [analytics, hostListData] = await Promise.all([
    adminService.getHostAnalyticsPhase1(),
    adminService.listHostsPhase1({ take: 100 }),
  ]);

  return (
    <div className="w-full">
      <HostPhase1Dashboard
        analytics={analytics}
        initialHosts={hostListData.items}
      />
    </div>
  );
}
