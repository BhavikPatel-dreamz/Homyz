import React from "react";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getHostDashboardEntitlements } from "@/lib/entitlements/host-dashboard";
import { forbidden } from "next/navigation";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { hostEarningsAnalyticsService } from "@/services/host-earnings-analytics.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { HostEarningsAnalyticsClient } from "./host-earnings-analytics-client";
import { HOST_REPORTING_CONTAINER_CLASS, HOST_REPORTING_MAIN_CLASS } from "@/components/host/dashboard/host-reporting-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostEarningsAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  if (!(await getHostDashboardEntitlements(actor)).features.ADVANCED_EARNINGS) forbidden();
  const params = await searchParams;
  const displayCurrency = (await cookies()).get("homyz_display_currency")?.value || "SAR";
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const data = await hostEarningsAnalyticsService.getOverview(actor, {
    listingId: single(params.propertyId) || single(params.listingId),
    period: single(params.period) as DateRangePreset | undefined,
    startDate: single(params.startDate),
    endDate: single(params.endDate),
    comparisonStartDate: single(params.comparisonStartDate),
    comparisonEndDate: single(params.comparisonEndDate),
    currency: single(params.currency) || displayCurrency,
  });

  return <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-zinc-900 sm:pb-0">
    <HostHeader />
    <main className={HOST_REPORTING_MAIN_CLASS}><Container className={HOST_REPORTING_CONTAINER_CLASS}><HostEarningsAnalyticsClient initialData={data} /></Container></main>
  </div>;
}
