import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAdminPermissionResolution } from "@/lib/permissions/admin-permission-service";
import { AdminPermissionMatrixManager } from "@/components/admin/admin-permission-matrix-manager";

export default async function AdminIndividualPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission(PERMISSIONS.ADMINS_MANAGE_PERMISSIONS);

  const { id } = await params;

  let resolution;
  try {
    resolution = await getAdminPermissionResolution(id);
  } catch (error) {
    console.error("[AdminIndividualPermissionsPage] Error loading resolution for id:", id, error);
    notFound();
  }

  if (!resolution) {
    notFound();
  }

  return <AdminPermissionMatrixManager initialResolution={resolution} />;
}
