import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { HostSupportCenter } from "@/components/host/support/host-support-center";

export const dynamic = "force-dynamic";

export default async function HostSupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageRole([Role.HOST]);
  const resolvedParams = searchParams ? await searchParams : {};
  const caseId = typeof resolvedParams.caseId === "string" ? resolvedParams.caseId : undefined;

  // Safe redirect for existing URLs containing caseId
  if (caseId) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedParams)) {
      if (key === "caseId") continue;
      if (typeof value === "string") query.set(key, value);
      else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
    }
    const qs = query.toString() ? `?${query.toString()}` : "";
    redirect(`/host/support/cases/${encodeURIComponent(caseId)}${qs}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-0">
      <HostHeader />
      <main className="flex-1 py-8 sm:py-10">
        <Container className="px-4 sm:px-6">
          <HostSupportCenter />
        </Container>
      </main>
    </div>
  );
}
