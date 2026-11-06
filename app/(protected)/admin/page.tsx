import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { adminBusinessOverviewService } from "@/services/admin-business-overview.service";
import { AdminOverviewClient } from "@/components/admin/admin-overview-client";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requirePageRole([Role.ADMIN]);

  const overviewData = await adminBusinessOverviewService.getOverview({
    period: "30d",
  });

  return <AdminOverviewClient initialData={overviewData} />;
}
