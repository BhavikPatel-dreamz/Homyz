import React from "react";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostReportingService } from "@/services/host-reporting.service";
import { HostEarningsReportsClient } from "./host-earnings-reports-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostEarningsReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const rawYear = single(params.year);
  const year = rawYear ? parseInt(rawYear, 10) : undefined;
  const listingId = single(params.propertyId) || single(params.listingId);
  const cookieStore = await cookies();
  const displayCurrency = cookieStore.get("homyz_display_currency")?.value;
  const currency = single(params.currency) || displayCurrency || "SAR";

  const initialData = await hostReportingService.getReportsLanding(actor.id, {
    year: Number.isInteger(year) ? year : undefined,
    listingId,
    currency,
  });

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-16 pt-8 sm:pb-24 sm:pt-10">
        <Container className="max-w-5xl px-4 sm:px-6">
          <HostEarningsReportsClient initialData={initialData} />
        </Container>
      </main>
    </div>
  );
}

