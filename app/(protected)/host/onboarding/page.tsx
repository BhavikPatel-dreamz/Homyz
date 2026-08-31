import { requirePageUser } from "@/lib/permissions/page-guards";
import { hostApplicationService } from "@/services/host-application.service";
import { HostApplicationWorkspace } from "@/components/host/host-application-workspace";

export const metadata = {
  title: "Host Application & Onboarding | Homyz",
  description: "Complete host application registration, document upload, and onboarding progress tracking.",
};

export default async function HostOnboardingPage() {
  const user = await requirePageUser("/host/onboarding");

  // Fetch initial host application & onboarding data server-side
  const data = await hostApplicationService.getApplicationForUser(user);

  return (
    <div className="w-full bg-[var(--background)] min-h-[calc(100vh-4rem)]">
      <HostApplicationWorkspace initialData={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}
