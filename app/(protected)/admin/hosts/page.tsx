import { requirePageRole, requirePagePermission } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { HostPhase1Dashboard } from "@/components/admin/host-phase1-dashboard";

export const metadata = {
  title: "Host Management | Homyz Admin",
  description: "Administrative dashboard for host accounts, listings, reservations, and account activity.",
};

export default async function AdminHostManagementPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePageRole([Role.ADMIN]);
  await requirePagePermission(PERMISSIONS.HOSTS_VIEW);

  const resolvedParams = props.searchParams ? await props.searchParams : {};
  const initialSearch = typeof resolvedParams.search === "string" ? resolvedParams.search : "";
  const initialStatus = typeof resolvedParams.status === "string" ? resolvedParams.status.toUpperCase() : "ALL";
  const initialSortBy = typeof resolvedParams.sort === "string" ? resolvedParams.sort : "createdAt";
  const initialSortOrder = typeof resolvedParams.order === "string" ? resolvedParams.order.toLowerCase() : "desc";
  const initialPage = typeof resolvedParams.page === "string" ? parseInt(resolvedParams.page, 10) || 1 : 1;
  const initialPageSize = typeof resolvedParams.pageSize === "string" ? parseInt(resolvedParams.pageSize, 10) || 10 : 10;

  const result = await adminService.listUnifiedHosts({ take: 500 });

  return (
    <div className="w-full">
      <HostPhase1Dashboard
        analytics={result.analytics}
        initialHosts={result.items}
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
