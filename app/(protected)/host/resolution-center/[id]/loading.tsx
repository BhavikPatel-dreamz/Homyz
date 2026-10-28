import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { HostDisputeDetailsSkeleton } from "@/components/host/host-dispute-details-skeleton";

export default function HostDisputeDetailsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-12">
      <HostHeader />
      <main className="flex-1 py-6 sm:py-8 lg:py-10" aria-busy="true">
        <Container className="px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <HostDisputeDetailsSkeleton />
        </Container>
      </main>
    </div>
  );
}
