import React from "react";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { payoutService } from "@/services/payout.service";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";
import { HostEarningsClient } from "./host-earnings-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostEarningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const cookieStore = await cookies();
  const displayCurrency = cookieStore.get("homyz_display_currency")?.value;
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const month = Number(single(params.month));
  const year = Number(single(params.year));
  const quarter = Number(single(params.quarter));
  const compareMonth = Number(single(params.compareMonth));
  const compareYear = Number(single(params.compareYear));
  const compareQuarter = Number(single(params.compareQuarter));

  const overview = await payoutService.getHostEarningsOverview(actor.id, {
    listingId: single(params.propertyId) || single(params.listingId),
    month: Number.isInteger(month) ? month : undefined,
    year: Number.isInteger(year) ? year : undefined,
    currency: single(params.currency) || displayCurrency || "SAR",
    timeframe: (single(params.timeframe) as TimeframeGranularity) || undefined,
    date: single(params.date) || undefined,
    weekStart: single(params.weekStart) || undefined,
    quarter: Number.isInteger(quarter) ? quarter : undefined,
    startDate: single(params.startDate) || undefined,
    endDate: single(params.endDate) || undefined,
    compareEnabled: single(params.compare) === "true",
    compareTimeframe: (single(params.compareTimeframe) as TimeframeGranularity) || undefined,
    compareStartDate: single(params.compareStartDate) || undefined,
    compareEndDate: single(params.compareEndDate) || undefined,
    compareMonth: Number.isInteger(compareMonth) ? compareMonth : undefined,
    compareYear: Number.isInteger(compareYear) ? compareYear : undefined,
    compareQuarter: Number.isInteger(compareQuarter) ? compareQuarter : undefined,
  });

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-12 pt-8 sm:pb-24 sm:pt-10">
        <Container className="px-4 sm:px-6">
          <HostEarningsClient initialData={overview} />
        </Container>
      </main>
    </div>
  );
}
