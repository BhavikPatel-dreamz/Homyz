import React from "react";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { hostEarningsAnalyticsService } from "@/services/host-earnings-analytics.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { HostEarningsAnalyticsClient } from "./host-earnings-analytics-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostEarningsAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
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
    <main className="w-full min-w-0 flex-1 py-8 sm:py-10"><Container className="max-w-6xl px-4 sm:px-6"><HostEarningsAnalyticsClient initialData={data} /></Container></main>
  </div>;
}
