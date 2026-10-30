import { AdminSupportManagement } from "@/components/admin/support/admin-support-management";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await requirePagePermission(PERMISSIONS.DISPUTES_VIEW);
  return <AdminSupportManagement />;
}
