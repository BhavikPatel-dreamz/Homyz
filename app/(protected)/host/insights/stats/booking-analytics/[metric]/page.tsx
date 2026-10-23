import React from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { hostBookingAnalyticsService } from "@/services/host-booking-analytics.service";
import { HostBookingAnalyticsClient } from "../host-booking-analytics-client";

const metrics = new Set(["occupancy", "booking-times", "lead-time", "stay-length", "pricing-history", "property-comparison"]);
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BookingAnalyticsMetricPage({ params, searchParams }: { params: Promise<{ metric: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const { metric } = await params;
  if (!metrics.has(metric)) notFound();
  const query = await searchParams;
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const data = await hostBookingAnalyticsService.getOverview(actor, {
    listingId: single(query.propertyId) || single(query.listingId), period: single(query.period) as DateRangePreset | undefined,
    startDate: single(query.startDate), endDate: single(query.endDate), comparisonStartDate: single(query.comparisonStartDate), comparisonEndDate: single(query.comparisonEndDate),
    currency: single(query.currency) || (await cookies()).get("homyz_display_currency")?.value || "SAR",
    propertyLimit: metric === "property-comparison" ? null : undefined,
  });
  return <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-zinc-900 sm:pb-0"><HostHeader /><main className="w-full min-w-0 flex-1 py-8 sm:py-10"><Container className="max-w-6xl px-4 sm:px-6"><HostBookingAnalyticsClient initialData={data} focus={metric} /></Container></main></div>;
}
