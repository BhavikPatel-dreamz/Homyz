import React from "react";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { HostDashboardFooter } from "@/components/host/dashboard/host-dashboard-footer";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { payoutService } from "@/services/payout.service";
import { HostEarningsClient } from "./host-earnings-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostEarningsPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const overview = await payoutService.getHostEarningsOverview(actor.id);

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FEE08B] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-12 pt-8 sm:pb-24 sm:pt-10">
        <Container className="px-4 sm:px-6">
          <HostEarningsClient initialData={overview} />
        </Container>
      </main>
      <HostDashboardFooter />
    </div>
  );
}

