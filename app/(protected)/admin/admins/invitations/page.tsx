import { AdminInvitationsTable } from "@/components/admin/admin-invitations-table";
import { AdminManagementTabs } from "@/components/admin/admin-management-tabs";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { invitationService } from "@/services/invitation.service";
import { prisma } from "@/lib/db/prisma";

export default async function AdminInvitationsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePagePermission(PERMISSIONS.ADMINS_VIEW);

  const searchParams = props.searchParams ? await props.searchParams : {};
  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "ALL";
  const role = typeof searchParams.role === "string" ? searchParams.role : "ALL";
  const dateRange = typeof searchParams.dateRange === "string" ? searchParams.dateRange : "ALL";
  const page = typeof searchParams.page === "string" ? Math.max(1, parseInt(searchParams.page, 10) || 1) : 1;
  const pageSize = typeof searchParams.pageSize === "string" ? Math.max(1, parseInt(searchParams.pageSize, 10) || 10) : 10;

  const [
    invitationsRes,
    roles,
    totalCount,
    pendingCount,
    acceptedCount,
    expiredRevokedCount,
  ] = await Promise.all([
    invitationService.listInvitations({
      skip: (page - 1) * pageSize,
      take: pageSize,
      search: search || undefined,
      status: status !== "ALL" ? status : undefined,
      role: role !== "ALL" ? role : undefined,
      dateRange: dateRange !== "ALL" ? dateRange : undefined,
    }),
    adminService.listRoles(),
    prisma.adminInvitation.count(),
    prisma.adminInvitation.count({ where: { status: "PENDING" } }),
    prisma.adminInvitation.count({ where: { status: "ACCEPTED" } }),
    prisma.adminInvitation.count({
      where: {
        status: { in: ["EXPIRED", "REVOKED", "FAILED"] },
      },
    }),
  ]);

  const roleOptions = roles.map((r: any) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-muted-foreground">
          Admin Invitations Management
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Invite new administrators via email, manage pending setup tokens, and audit account activations.
        </p>
      </div>

      <AdminManagementTabs />

      <AdminInvitationsTable
        initialInvitations={invitationsRes.items as any}
        initialTotal={invitationsRes.total}
        availableRoles={roleOptions}
        initialSearch={search}
        initialStatus={status}
        initialRole={role}
        initialDateRange={dateRange}
        initialPage={page}
        initialPageSize={pageSize}
        metrics={{
          total: totalCount,
          pending: pendingCount,
          accepted: acceptedCount,
          expiredRevoked: expiredRevokedCount,
        }}
      />
    </div>
  );
}
