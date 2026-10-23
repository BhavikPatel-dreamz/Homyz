import React from "react";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { hostBookingAnalyticsService } from "@/services/host-booking-analytics.service";
import { HostBookingAnalyticsClient } from "./host-booking-analytics-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BookingAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const data = await hostBookingAnalyticsService.getOverview(actor, {
    listingId: single(params.propertyId) || single(params.listingId),
    period: single(params.period) as DateRangePreset | undefined,
    startDate: single(params.startDate), endDate: single(params.endDate),
    comparisonStartDate: single(params.comparisonStartDate), comparisonEndDate: single(params.comparisonEndDate),
    currency: single(params.currency) || (await cookies()).get("homyz_display_currency")?.value || "SAR",
  });
  return <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-zinc-900 sm:pb-0"><HostHeader /><main className="w-full min-w-0 flex-1 py-8 sm:py-10"><Container className="max-w-6xl px-4 sm:px-6"><HostBookingAnalyticsClient initialData={data} /></Container></main></div>;
}
