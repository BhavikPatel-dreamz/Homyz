import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
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
  const { id } = await params;

  const hostDetailsData = await adminService.getUnifiedHostDetails(id);

  return (
    <div className="w-full">
      <HostDetailsView initialData={hostDetailsData} />
    </div>
  );
}
