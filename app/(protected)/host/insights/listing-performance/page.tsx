import React from "react";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostListingPerformanceService } from "@/services/host-listing-performance.service";
import { HostListingPerformanceClient } from "./host-listing-performance-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostListingPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const data = await hostListingPerformanceService.getListingPerformance(actor, {
    listingId: single(params.propertyId) || single(params.listingId),
    checkIn: single(params.checkIn),
    checkOut: single(params.checkOut),
    guests: Number(single(params.guests)) || undefined,
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50/60 pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-16 pt-8 sm:pb-24 sm:pt-10">
        <Container className="max-w-5xl px-4 sm:px-6">
          {data ? <HostListingPerformanceClient initialData={data} /> : <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Add a listing to view listing performance.</p>}
        </Container>
      </main>
    </div>
  );
}
