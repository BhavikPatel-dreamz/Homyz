import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { HostCaseDetailClient } from "@/components/host/support/host-case-detail-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostSupportCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageRole([Role.HOST]);
  const { caseId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-12">
      <HostHeader />
      <main className="flex-1 py-6 sm:py-8 lg:py-10">
        <Container className="px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <HostCaseDetailClient
            caseId={caseId}
            initialSearchParams={resolvedSearchParams}
          />
        </Container>
      </main>
    </div>
  );
}

