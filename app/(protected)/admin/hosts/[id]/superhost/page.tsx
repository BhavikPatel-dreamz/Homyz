import { Role } from "@/generated/prisma/enums";
import { SuperhostAssessmentManager } from "@/components/admin/superhost-assessment-manager";
import { requirePagePermission, requirePageRole } from "@/lib/permissions/page-guards";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { getLiveSuperhostStatus, getSuperhostAssessmentHistory } from "@/services/superhost.service";

export const dynamic = "force-dynamic";

export default async function AdminHostSuperhostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole([Role.ADMIN]);
  const admin = await requirePagePermission(PERMISSIONS.HOSTS_VIEW);
  const { id } = await params;
  const [initial, history] = await Promise.all([getLiveSuperhostStatus(id), getSuperhostAssessmentHistory(id)]);
  return <SuperhostAssessmentManager hostId={id} initial={initial} history={history} canRerun={hasPermission(admin, PERMISSIONS.HOSTS_EDIT)} />;
}
