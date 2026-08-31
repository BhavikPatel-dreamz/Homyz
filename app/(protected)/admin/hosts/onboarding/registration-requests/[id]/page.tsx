import { requirePageRole, requirePagePermission } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { HostRegistrationWorkspace } from "@/components/admin/host-registration-workspace";
import { HostOnboardingSubNav } from "@/components/admin/host-onboarding-sub-nav";

export const metadata = {
  title: "Host Application & Verification Workspace | Homyz Admin",
  description: "Detailed review and document verification workspace for host registration request.",
};

interface HostRegistrationRequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HostRegistrationRequestDetailPage({
  params,
}: HostRegistrationRequestDetailPageProps) {
  await requirePageRole([Role.ADMIN]);
  await requirePagePermission([
    PERMISSIONS.HOST_REGISTRATION_VIEW,
    PERMISSIONS.HOST_REGISTRATION_REVIEW,
    PERMISSIONS.HOSTS_VIEW,
  ]);
  const { id } = await params;

  return (
    <div className="w-full space-y-4">
      <HostOnboardingSubNav />
      <HostRegistrationWorkspace requestId={id} />
    </div>
  );
}
