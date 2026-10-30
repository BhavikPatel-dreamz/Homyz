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
import { normalizeAnalyticsReportingFilters } from "@/lib/dashboard/insights-query";
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
  const analyticsFilters = normalizeAnalyticsReportingFilters(new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => [key, item]) : value ? [[key, value]] : [],
    ),
  ));
  const data = await hostEarningsAnalyticsService.getOverview(actor, {
    listingId: single(params.propertyId) || single(params.listingId),
    period: analyticsFilters.period as DateRangePreset | undefined,
    startDate: analyticsFilters.startDate,
    endDate: analyticsFilters.endDate,
    comparisonStartDate: single(params.comparisonStartDate),
    comparisonEndDate: single(params.comparisonEndDate),
    currency: single(params.currency) || displayCurrency,
    propertyPage: Number(single(params.propertyPage) || "1"),
    propertyPageSize: Number(single(params.propertyPageSize) || "10"),
    propertySearch: single(params.propertySearch),
    propertySort: single(params.propertySort) as "net" | "gross" | "revpan" | "occupancy" | "bookings" | "nightly_rate" | undefined,
    propertyStatus: single(params.propertyStatus) as "all" | "with_earnings" | "without_earnings" | undefined,
  });

  return <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-zinc-900 sm:pb-0">
    <HostHeader />
    <main className={HOST_REPORTING_MAIN_CLASS}><Container className={HOST_REPORTING_CONTAINER_CLASS}><HostEarningsAnalyticsClient initialData={data} /></Container></main>
  </div>;
}
