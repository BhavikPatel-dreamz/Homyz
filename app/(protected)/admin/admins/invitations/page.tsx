import { AdminInvitationsTable } from "@/components/admin/admin-invitations-table";
import { AdminManagementTabs } from "@/components/admin/admin-management-tabs";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { invitationService } from "@/services/invitation.service";

export default async function AdminInvitationsPage() {
  await requirePagePermission(PERMISSIONS.ADMINS_VIEW);

  const [invitationsRes, roles] = await Promise.all([
    invitationService.listInvitations({ skip: 0, take: 10 }),
    adminService.listRoles(),
  ]);

  const roleOptions = roles.map((r: any) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
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
      />
    </div>
  );
}
