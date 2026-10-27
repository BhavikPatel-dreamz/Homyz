import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { listAdminTravelStamps } from "@/services/travel-stamp.service";
import { AdminTravelStampsClient } from "@/components/admin/travel-stamps/admin-travel-stamps-client";

export const metadata = {
  title: "Travel Stamp Management | Homyz Admin",
  description: "Create, curate, and manage destination travel stamps for guests to collect.",
};

export default async function AdminTravelStampsPage() {
  await requirePageRole([Role.ADMIN]);
  const stamps = await listAdminTravelStamps({});

  return (
    <div className="w-full">
      <AdminTravelStampsClient initialStamps={stamps} />
    </div>
  );
}

