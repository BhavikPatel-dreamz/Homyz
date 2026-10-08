import { HostDashboardFooter } from "@/components/host/dashboard/host-dashboard-footer";
import { HostDashboardOverviewSkeleton } from "@/components/host/dashboard/host-kpi-overview";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";

/** Mirrors the dashboard route shell and content geometry while analytics load. */
export default function HostDashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 font-sans text-[#1F1F1F] selection:bg-[#FEE08B]">
      <HostHeader />
      <main className="w-full min-w-0 pb-5 pt-4 sm:flex-1 sm:pt-10 xl:pb-24">
        <Container className="px-4 sm:px-6">
          <HostDashboardOverviewSkeleton />
        </Container>
      </main>
      <HostDashboardFooter />
    </div>
  );
}
