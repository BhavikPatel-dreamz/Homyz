import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { HostKpiOverview } from "@/components/host/dashboard/host-kpi-overview";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getHostDashboardData } from "@/services/host-dashboard.service";
import { HOST_REPORTING_CONTAINER_CLASS, HOST_REPORTING_MAIN_CLASS } from "@/components/host/dashboard/host-reporting-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Financial and performance reporting is intentionally separate from the
 * operational Today workspace (arrivals, stays, and reservation actions). */
export default async function HostDashboardPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const dashboardData = await getHostDashboardData(actor);

  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 font-sans text-[#1F1F1F] selection:bg-[#FCDF9C]">
      <HostHeader />
      <main className={HOST_REPORTING_MAIN_CLASS}>
        <Container className={HOST_REPORTING_CONTAINER_CLASS}>
          <HostKpiOverview initialData={dashboardData} />
        </Container>
      </main>
    </div>
  );
}
