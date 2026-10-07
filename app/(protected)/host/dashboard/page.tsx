import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { HostDashboardFooter } from "@/components/host/dashboard/host-dashboard-footer";
import { HostKpiOverview } from "@/components/host/dashboard/host-kpi-overview";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getHostDashboardData } from "@/services/host-dashboard.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Financial and performance reporting is intentionally separate from the
 * operational Today workspace (arrivals, stays, and reservation actions). */
export default async function HostDashboardPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const dashboardData = await getHostDashboardData(actor);

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FEE08B] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-12 pt-8 sm:pb-24 sm:pt-10">
        <Container>
          <HostKpiOverview initialData={dashboardData} />
        </Container>
      </main>
      <HostDashboardFooter />
    </div>
  );
}
