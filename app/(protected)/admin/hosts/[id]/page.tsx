import { redirect } from "next/navigation";
import { requirePagePermission, requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { HostDetailsView } from "@/components/admin/host-details-view";

export const metadata = {
  title: "Host Details — Homyz Admin",
  description: "Host account details, listings, reservations, earnings, and account activity.",
};

export default async function AdminHostDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole([Role.ADMIN]);
  const admin = await requirePagePermission([
    PERMISSIONS.HOSTS_VIEW,
    PERMISSIONS.HOST_REGISTRATION_VIEW,
  ]);
  const { id } = await params;
  const role = await adminService.getUserRole(id);
  if (role === Role.USER) {
    redirect(`/admin/guests/${id}`);
  }

  const hostDetailsData = await adminService.getUnifiedHostDetails(id);

  return (
    <div className="w-full">
      <HostDetailsView
        initialData={hostDetailsData}
        canViewIdentity={
          hasPermission(admin, PERMISSIONS.HOSTS_VIEW) ||
          hasPermission(admin, PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS)
        }
        canReviewIdentity={
          hasPermission(admin, PERMISSIONS.HOSTS_VERIFY) ||
          hasPermission(admin, PERMISSIONS.HOST_REGISTRATION_VERIFY_DOCUMENTS)
        }
      />
    </div>
  );
}
