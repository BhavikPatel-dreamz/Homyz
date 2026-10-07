import { HostDashboardFooter } from "@/components/host/dashboard/host-dashboard-footer";
import { HostDashboardOverviewSkeleton } from "@/components/host/dashboard/host-kpi-overview";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";

/** Mirrors the dashboard route shell and content geometry while analytics load. */
export default function HostDashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FEE08B] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-12 pt-8 sm:pb-24 sm:pt-10">
        <Container>
          <HostDashboardOverviewSkeleton />
        </Container>
      </main>
      <HostDashboardFooter />
    </div>
  );
}
