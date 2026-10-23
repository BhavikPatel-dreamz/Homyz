import React from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostStatsInsightsService } from "@/services/host-stats-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { HostStatMetricClient } from "./host-stat-metric-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostStatMetricPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const { metric } = await params;
  const sp = await searchParams;

  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const propertyId = single(sp.propertyId) || single(sp.listingId);
  const period = single(sp.period) as DateRangePreset | undefined;
  const startDate = single(sp.startDate);
  const endDate = single(sp.endDate);
  const cookieStore = await cookies();
  const displayCurrency = cookieStore.get("homyz_display_currency")?.value;
  const currency = single(sp.currency) || displayCurrency || "SAR";

  let data;
  try {
    data = await hostStatsInsightsService.getMetricDetail(actor, metric, {
      propertyId,
      period,
      startDate,
      endDate,
      currency,
    });
  } catch (error) {
    // A real unsupported metric receives a normal 404. Authorization, data,
    // and server failures must not be disguised as an "under development" page.
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50/60 pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-16 pt-8 sm:pb-24 sm:pt-10">
        <Container className="max-w-5xl px-4 sm:px-6">
          <HostStatMetricClient initialData={data} />
        </Container>
      </main>
    </div>
  );
}
