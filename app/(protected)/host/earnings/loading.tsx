import { HostDashboardFooter } from "@/components/host/dashboard/host-dashboard-footer";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";

export default function HostEarningsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FEE08B] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-12 pt-8 sm:pb-24 sm:pt-10">
        <Container className="px-4 sm:px-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded-lg bg-gray-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 rounded-2xl bg-gray-200" />
              <div className="h-24 rounded-2xl bg-gray-200" />
              <div className="h-24 rounded-2xl bg-gray-200" />
              <div className="h-24 rounded-2xl bg-gray-200" />
            </div>
            <div className="h-48 rounded-2xl bg-gray-200" />
            <div className="h-64 rounded-2xl bg-gray-200" />
          </div>
        </Container>
      </main>
      <HostDashboardFooter />
    </div>
  );
}

