import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { HostResolutionCenterSkeleton } from "@/components/host/host-resolution-center-skeleton";

export default function HostResolutionCenterLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="resolution" showRightActions={false} />
      <main className="flex-1 py-8 sm:py-10" aria-busy="true">
        <Container className="px-4 sm:px-6">
          <HostResolutionCenterSkeleton />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
