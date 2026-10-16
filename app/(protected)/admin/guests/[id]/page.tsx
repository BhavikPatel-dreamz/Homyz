import { redirect } from "next/navigation";
import { requirePagePermission, requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { GuestDetailsView } from "@/components/admin/guest-details-view";

export const metadata = {
  title: "Guest Details — Homyz Admin",
  description: "Guest profile overview, reservation history, spending activity, and administrative account controls.",
};

export default async function AdminGuestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole([Role.ADMIN]);
  const admin = await requirePagePermission(PERMISSIONS.GUESTS_VIEW);
  const { id } = await params;
  const role = await adminService.getUserRole(id);
  if (role === Role.HOST) {
    redirect(`/admin/hosts/${id}`);
  }

  const guestDetailsData = await adminService.getGuestDetails(id);

  return (
    <div className="w-full">
      <GuestDetailsView
        initialData={guestDetailsData}
        canReviewIdentity={
          hasPermission(admin, PERMISSIONS.GUESTS_EDIT) ||
          hasPermission(admin, PERMISSIONS.USERS_EDIT)
        }
      />
    </div>
  );
}
