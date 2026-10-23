import React from "react";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostInsightsService, type InsightsTab } from "@/services/host-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { HostInsightsClient } from "./host-insights-client";
import { HOST_REPORTING_CONTAINER_CLASS, HOST_REPORTING_MAIN_CLASS } from "@/components/host/dashboard/host-reporting-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostInsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const cookieStore = await cookies();
  const displayCurrency = cookieStore.get("homyz_display_currency")?.value;

  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const tab = single(params.tab) as InsightsTab | undefined;
  const listingId = single(params.propertyId) || single(params.listingId);
  const period = single(params.period) as DateRangePreset | undefined;
  const startDate = single(params.startDate);
  const endDate = single(params.endDate);
  const currency = single(params.currency) || displayCurrency || "SAR";

  const initialData = await hostInsightsService.getInsights(actor, {
    tab,
    listingId,
    period,
    startDate,
    endDate,
    currency,
  });

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className={HOST_REPORTING_MAIN_CLASS}>
        <Container className={HOST_REPORTING_CONTAINER_CLASS}>
          <HostInsightsClient initialData={initialData} />
        </Container>
      </main>
    </div>
  );
}
