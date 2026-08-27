import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
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
  const { id } = await params;

  const guestDetailsData = await adminService.getGuestDetails(id);

  return (
    <div className="w-full">
      <GuestDetailsView initialData={guestDetailsData} />
    </div>
  );
}
