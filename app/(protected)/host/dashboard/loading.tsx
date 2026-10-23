import { HostDashboardOverviewSkeleton } from "@/components/host/dashboard/host-kpi-overview";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { HOST_REPORTING_CONTAINER_CLASS, HOST_REPORTING_MAIN_CLASS } from "@/components/host/dashboard/host-reporting-layout";

/** Mirrors the dashboard route shell and content geometry while analytics load. */
export default function HostDashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 font-sans text-[#1F1F1F] selection:bg-[#FCDF9C]">
      <HostHeader />
      <main className={HOST_REPORTING_MAIN_CLASS}>
        <Container className={HOST_REPORTING_CONTAINER_CLASS}>
          <HostDashboardOverviewSkeleton />
        </Container>
      </main>
    </div>
  );
}
