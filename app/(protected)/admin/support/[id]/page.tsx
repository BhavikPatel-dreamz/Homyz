import { AdminSupportManagement } from "@/components/admin/support/admin-support-management";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission(PERMISSIONS.DISPUTES_VIEW);
  const { id } = await params;
  return <AdminSupportManagement caseId={id} />;
}
