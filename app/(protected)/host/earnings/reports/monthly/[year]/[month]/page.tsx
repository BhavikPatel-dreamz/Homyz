import React from "react";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostReportingService } from "@/services/host-reporting.service";
import { HostMonthlyReportClient } from "./host-monthly-report-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostMonthlyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const [{ year: rawYear, month: rawMonth }, urlParams] = await Promise.all([params, searchParams]);

  const year = parseInt(rawYear, 10);
  const month = parseInt(rawMonth, 10);
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const listingId = single(urlParams.propertyId) || single(urlParams.listingId);
  const currency = single(urlParams.currency);

  const initialData = await hostReportingService.getMonthlyReport(actor.id, year, month, {
    listingId,
    currency,
  });

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-16 pt-8 sm:pb-24 sm:pt-10">
        <Container className="max-w-5xl px-4 sm:px-6">
          <HostMonthlyReportClient initialData={initialData} />
        </Container>
      </main>
    </div>
  );
}

