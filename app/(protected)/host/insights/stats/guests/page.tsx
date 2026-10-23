import React from "react";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostGuestInsightsService } from "@/services/host-guest-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { HostGuestInsightsClient } from "./host-guest-insights-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostGuestInsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const sp = await searchParams;

  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const propertyId = single(sp.propertyId) || single(sp.listingId);
  const period = single(sp.period) as DateRangePreset | undefined;
  const startDate = single(sp.startDate);
  const endDate = single(sp.endDate);

  const initialData = await hostGuestInsightsService.getGuestInsightsOverview(actor, {
    propertyId,
    period,
    startDate,
    endDate,
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50/60 pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-16 pt-8 sm:pb-24 sm:pt-10">
        <Container className="max-w-5xl px-4 sm:px-6">
          <HostGuestInsightsClient initialData={initialData} />
        </Container>
      </main>
    </div>
  );
}

