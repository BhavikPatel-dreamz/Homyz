import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { disputeService } from "@/services/dispute.service";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { HostDisputeDetailsClient } from "@/components/host/host-dispute-details-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostDisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageRole([Role.HOST]);
  const { id } = await params;
  let details: Awaited<ReturnType<typeof disputeService.getDisputeDetailsForHost>>;
  try {
    details = await disputeService.getDisputeDetailsForHost(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="resolution" showRightActions={false} />
      <main className="flex-1 py-8 sm:py-10">
        <Container className="px-4 sm:px-6">
          <HostDisputeDetailsClient initialData={details} />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
