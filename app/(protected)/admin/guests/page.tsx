import { requirePageRole, requirePagePermission } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { GuestManagementDashboard } from "@/components/admin/guest-management-dashboard";

export const metadata = {
  title: "Guest Management — Homyz Admin",
  description: "Manage all platform guests, view bookings, spending analytics, and account controls.",
};

export default async function AdminGuestsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePageRole([Role.ADMIN]);
  await requirePagePermission(PERMISSIONS.GUESTS_VIEW);

  const resolvedParams = props.searchParams ? await props.searchParams : {};
  const initialSearch = typeof resolvedParams.search === "string" ? resolvedParams.search : "";
  const initialStatus = typeof resolvedParams.status === "string" ? resolvedParams.status.toUpperCase() : "ALL";
  const initialSortBy = typeof resolvedParams.sort === "string" ? resolvedParams.sort : "createdAt";
  const initialSortOrder = typeof resolvedParams.order === "string" ? resolvedParams.order.toLowerCase() : "desc";
  const initialPage = typeof resolvedParams.page === "string" ? parseInt(resolvedParams.page, 10) || 1 : 1;
  const initialPageSize = typeof resolvedParams.pageSize === "string" ? parseInt(resolvedParams.pageSize, 10) || 10 : 10;

  const [analytics, guestsRes] = await Promise.all([
    adminService.getGuestAnalytics(),
    adminService.listGuests({ page: 1, take: 500 }),
  ]);

  return (
    <div className="w-full">
      <GuestManagementDashboard
        analytics={analytics}
        initialGuests={guestsRes.items}
        initialSearch={initialSearch}
        initialStatus={initialStatus}
        initialSortBy={initialSortBy}
        initialSortOrder={initialSortOrder}
        initialPage={initialPage}
        initialPageSize={initialPageSize}
      />
    </div>
  );
}
