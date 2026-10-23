import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { hostEarningsAnalyticsService } from "@/services/host-earnings-analytics.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const money = (cents: number | null, currency: string) => cents === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export default async function RevpanDetailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const displayCurrency = (await cookies()).get("homyz_display_currency")?.value || "SAR";
  const data = await hostEarningsAnalyticsService.getOverview(actor, {
    listingId: single(params.propertyId) || single(params.listingId),
    period: single(params.period) as DateRangePreset | undefined,
    startDate: single(params.startDate),
    endDate: single(params.endDate),
    comparisonStartDate: single(params.comparisonStartDate),
    comparisonEndDate: single(params.comparisonEndDate),
    currency: single(params.currency) || displayCurrency,
  });
  const currency = data.currency || "SAR";
  const backQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = single(value);
    if (item) backQuery.set(key, item);
  }
  const backHref = `/host/earnings/analytics${backQuery.size ? `?${backQuery.toString()}` : ""}`;

  return <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-zinc-900 sm:pb-0">
    <HostHeader />
    <main className="w-full min-w-0 flex-1 py-8 sm:py-10"><Container className="max-w-5xl px-4 sm:px-6">
      <Link href={backHref} className="text-xs font-semibold underline underline-offset-4">← Back to Advanced Earnings Analytics</Link>
      <header className="mt-6 border-b border-zinc-200 pb-5"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">RevPAN detail</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Revenue per available night</h1><p className="mt-2 max-w-2xl text-sm text-zinc-600">Eligible accommodation revenue divided by bookable inventory nights. Owner-blocked nights are excluded under the shared Host Dashboard inventory policy.</p></header>
      <section className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_1fr]"><div className="rounded-3xl bg-zinc-950 p-7 text-white"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{data.reportingPeriod.label}</p><p className="mt-5 text-5xl font-bold tracking-tight">{money(data.revpan.valueCents, currency)}</p><p className="mt-3 text-sm text-zinc-300">Current RevPAN · {data.reportingPeriod.comparisonLabel}: {money(data.revpan.previousValueCents, currency)}</p></div><div className="rounded-3xl border border-zinc-200 p-7"><p className="text-sm font-semibold">Inventory relationship</p><dl className="mt-5 space-y-3 text-sm"><Stat label="Eligible accommodation revenue" value={money(data.revenue.eligibleAccommodationRevenueCents, currency)} /><Stat label="Booked nights" value={String(data.revpan.bookedNights)} /><Stat label="Unbooked available nights" value={String(data.revpan.availableNights)} /><Stat label="Total bookable inventory nights" value={String(data.revpan.bookableNights)} /><Stat label="Occupancy rate" value={`${data.revpan.occupancyRatePercentage}%`} /></dl></div></section>
      <section className="mt-10"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Property breakdown</p><h2 className="mt-1 text-2xl font-bold tracking-tight">RevPAN by listing</h2><div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="p-4">Listing</th><th className="p-4">Accommodation revenue</th><th className="p-4">Bookable nights</th><th className="p-4">RevPAN</th></tr></thead><tbody>{data.properties.map((property) => <tr key={property.listingId} className="border-t border-zinc-200"><td className="p-4 font-semibold">{property.title}</td><td className="p-4">{money(property.eligibleAccommodationRevenueCents, currency)}</td><td className="p-4">{property.bookableNights}</td><td className="p-4">{money(property.revpanCents, currency)}</td></tr>)}</tbody></table></div></section>
      <section className="mt-10"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Historical realized revenue</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Completed-stay revenue trend</h2><div className="mt-5 rounded-3xl border border-zinc-200 p-5"><div className="flex h-48 items-end gap-1.5 border-b border-zinc-200">{data.trend.length ? data.trend.map((point) => <div key={point.dateKey} title={`${point.label}: ${money(point.accommodationRevenueCents, currency)} accommodation revenue`} className="min-w-2 flex-1 rounded-t bg-zinc-900" style={{ height: `${Math.max(point.accommodationRevenueCents ? 4 : 1, Math.round((point.accommodationRevenueCents / Math.max(...data.trend.map((item) => item.accommodationRevenueCents), 1)) * 100))}%` }} />) : <p className="m-auto text-sm text-zinc-500">No qualifying completed stays in this period.</p>}</div><p className="mt-3 text-xs text-zinc-500">Daily bars are based on the eligible accommodation revenue of completed stays, not a forecast.</p></div></section>
    </Container></main>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-6"><dt className="text-zinc-600">{label}</dt><dd className="font-semibold text-zinc-950">{value}</dd></div>; }
