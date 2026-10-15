import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { HostDisputeDetailsSkeleton } from "@/components/host/host-dispute-details-skeleton";

export default function HostDisputeDetailsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="resolution" showRightActions={false} />
      <main className="flex-1 py-8 sm:py-10" aria-busy="true">
        <Container className="px-4 sm:px-6">
          <HostDisputeDetailsSkeleton />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
