import { requirePageRole, requirePagePermission } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { GuestManagementDashboard } from "@/components/admin/guest-management-dashboard";

export const metadata = {
  title: "Guest Management — Homyz Admin",
  description: "Manage all platform guests, view bookings, spending analytics, and account controls.",
};

export default async function AdminGuestsPage() {
  await requirePageRole([Role.ADMIN]);
  await requirePagePermission(PERMISSIONS.GUESTS_VIEW);

  const [analytics, guestsRes] = await Promise.all([
    adminService.getGuestAnalytics(),
    adminService.listGuests({ page: 1, take: 50 }),
  ]);

  return (
    <div className="w-full">
      <GuestManagementDashboard
        analytics={analytics}
        initialGuests={guestsRes.items}
      />
    </div>
  );
}
