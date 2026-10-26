"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingPerformanceData } from "@/services/host-listing-performance.service";

export function HostListingPerformanceClient({ initialData }: { initialData: ListingPerformanceData }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statsHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "stats");
    return `/host/insights?${params.toString()}`;
  })();
  const formatMoney = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: data.priceComparison.currency, maximumFractionDigits: 0 }).format(value / 100);

  const refresh = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => next.set(key, value));
    startTransition(async () => {
      setError(null);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      try {
        const response = await fetch(`/api/v1/host/insights/listing-performance?${next.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || "Could not refresh listing performance.");
        setData(payload.data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not refresh listing performance.");
      }
    });
  };

  const rankingLabel = data.searchRanking.status === "OBSERVED" ? `#${data.searchRanking.position}` : data.searchRanking.status === "NOT_FOUND" ? "Not found" : "Unavailable";
  const difference = data.priceComparison.differenceCents === null ? "—" : `${data.priceComparison.differenceCents > 0 ? "+" : ""}${formatMoney(data.priceComparison.differenceCents)}`;

  return (
    <div className={`space-y-8 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={statsHref} className="text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">← Insights · Stats</Link>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Search check-in date" type="date" defaultValue={data.context.checkIn} onBlur={(event) => event.target.value && refresh({ checkIn: event.target.value })} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <input aria-label="Search check-out date" type="date" defaultValue={data.context.checkOut} onBlur={(event) => event.target.value && refresh({ checkOut: event.target.value })} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <input aria-label="Guest count" type="number" min="1" defaultValue={data.context.guests} onBlur={(event) => event.target.value && refresh({ guests: event.target.value })} className="w-20 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
        </div>
      </div>
      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Listing Performance</p>
        <div className="mt-2 flex items-center gap-4">
          {data.listing.photo && <Image src={data.listing.photo} alt="" width={56} height={56} className="h-14 w-14 rounded-2xl object-cover" />}
          <div><h1 className="text-2xl font-bold text-zinc-950">{data.listing.title}</h1><p className="mt-1 text-xs text-zinc-500">{data.listing.city || "Location unavailable"} · {data.context.checkIn} to {data.context.checkOut} · {data.context.guests} guest{data.context.guests === 1 ? "" : "s"}</p></div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Availability observation</p><h2 className="mt-1 text-xl font-bold text-zinc-950">Open inventory</h2>{data.pricingObservations.extendedEmptyNights ? <><p className="mt-4 text-3xl font-bold text-zinc-950">{data.pricingObservations.extendedEmptyNights.consecutiveNights} nights</p><p className="mt-2 text-sm text-zinc-600">Consecutive available nights from {data.pricingObservations.extendedEmptyNights.startDate} to {data.pricingObservations.extendedEmptyNights.endDate}.</p><Link href={`/host/calendar?listingId=${data.listing.id}`} className="mt-5 inline-block text-xs font-semibold underline underline-offset-4">Review calendar</Link></> : <p className="mt-4 text-sm text-zinc-600">No run of seven or more available nights was observed in the next 90 days.</p>}{data.pricingObservations.approachingAvailableWeekend && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Available weekend: {data.pricingObservations.approachingAvailableWeekend.startDate} to {data.pricingObservations.approachingAvailableWeekend.endDate}.</p>}</div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Lead-time observation</p><h2 className="mt-1 text-xl font-bold text-zinc-950">When guests book</h2>{data.pricingObservations.leadTime.typicalRange ? <><p className="mt-4 text-3xl font-bold text-zinc-950">{data.pricingObservations.leadTime.typicalRange}</p><p className="mt-2 text-sm text-zinc-600">Median {data.pricingObservations.leadTime.medianDays} days across {data.pricingObservations.leadTime.sampleSize} confirmed bookings.</p></> : <p className="mt-4 text-sm text-zinc-600">{data.pricingObservations.leadTime.message}</p>}</div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8"><div className="border-b border-zinc-100 pb-5"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Observed traffic · last 30 days</p><h2 className="mt-1 text-xl font-bold text-zinc-950">Search performance</h2><p className="mt-1 text-xs text-zinc-500">{data.searchPerformance.message}</p></div>{data.searchPerformance.status === "ACTIVE" ? <><div className="mt-5 grid gap-3 sm:grid-cols-5"><Metric label="Search impressions" value={String(data.searchPerformance.impressions)} /><Metric label="Listing views" value={String(data.searchPerformance.listingViews)} /><Metric label="Guest inquiries" value={String(data.searchPerformance.inquiries)} /><Metric label="View to inquiry" value={data.searchPerformance.viewToInquiryRatePercentage === null ? "—" : `${data.searchPerformance.viewToInquiryRatePercentage}%`} /><Metric label="Attributed conversion" value={data.searchPerformance.attributedBookingConversionPercentage === null ? "—" : `${data.searchPerformance.attributedBookingConversionPercentage}%`} /></div><p className="mt-4 text-[11px] text-zinc-500">{data.searchPerformance.trackingStartedAt ? `Tracking coverage begins ${new Date(data.searchPerformance.trackingStartedAt).toLocaleDateString()}.` : "Data appears after eligible first-party events are recorded."} View-to-inquiry is observed stage volume; booking conversion is session-attributed. Inquiry-to-booking conversion is unavailable until a durable inquiry-to-booking link is recorded.</p></> : <p className="mt-5 text-sm text-zinc-600">Search telemetry storage is unavailable in this deployment.</p>}</section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5"><div><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Search Visibility</p><h2 className="mt-1 text-xl font-bold text-zinc-950">Search Ranking</h2><p className="mt-1 text-xs text-zinc-500">Actual ordered Homyz public-search result for the context below.</p></div><span className="text-3xl font-bold text-zinc-950">{rankingLabel}</span></div>
        <p className="mt-4 text-sm text-zinc-700">{data.searchRanking.message}</p>
        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><Metric label="Location" value={data.listing.city || "—"} /><Metric label="Sort" value="Recommended" /><Metric label="Observed" value={data.searchRanking.observedAt ? new Date(data.searchRanking.observedAt).toLocaleString() : "—"} /></div>
        {data.searchRanking.history.length > 1 && <div className="mt-6"><p className="text-xs font-semibold text-zinc-700">Observed ranking history</p><div className="mt-2 flex gap-2 overflow-x-auto">{data.searchRanking.history.map((item) => <div key={item.observedAt} className="min-w-20 rounded-xl bg-zinc-50 p-2 text-center text-xs"><b>{item.position ? `#${item.position}` : "—"}</b><p className="mt-1 text-[10px] text-zinc-500">{new Date(item.observedAt).toLocaleDateString()}</p></div>)}</div></div>}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Similar Homyz Listings</p><h2 className="mt-1 text-xl font-bold text-zinc-950">Price Comparison</h2><p className="mt-1 text-xs text-zinc-500">{data.priceComparison.message}</p>
        {data.priceComparison.status === "AVAILABLE" ? <><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Your nightly price" value={formatMoney(data.priceComparison.yourNightlyPriceCents)} /><Metric label="Similar listings average" value={formatMoney(data.priceComparison.comparableAverageNightlyPriceCents)} /><Metric label="Difference" value={difference} /></div><div className="mt-6"><div className="flex h-5 overflow-hidden rounded-full bg-zinc-100"><div className="bg-zinc-950" style={{ width: `${Math.min(100, ((data.priceComparison.yourNightlyPriceCents || 0) / Math.max(data.priceComparison.yourNightlyPriceCents || 0, data.priceComparison.comparableAverageNightlyPriceCents || 0)) * 100)}%` }} /><div className="bg-amber-400" style={{ width: `${Math.min(100, ((data.priceComparison.comparableAverageNightlyPriceCents || 0) / Math.max(data.priceComparison.yourNightlyPriceCents || 0, data.priceComparison.comparableAverageNightlyPriceCents || 0)) * 100)}%` }} /></div><p className="mt-2 text-[11px] text-zinc-500">{data.priceComparison.comparableCount} comparable listings · Median {formatMoney(data.priceComparison.comparableMedianNightlyPriceCents)} · Range {formatMoney(data.priceComparison.comparableLowestNightlyPriceCents)}–{formatMoney(data.priceComparison.comparableHighestNightlyPriceCents)}</p></div></> : <div className="mt-6 rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-600">Not enough comparable listings available.</div>}
        <p className="mt-5 text-[11px] text-zinc-500">Criteria: {data.priceComparison.criteria.join(" · ")}</p>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-2 border-b border-zinc-100 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Comparable coverage</p><h2 className="mt-1 text-xl font-bold text-zinc-950">Similar listings</h2><p className="mt-1 text-xs text-zinc-500">Up to 10 qualifying published Homyz listings for this exact stay context.</p></div><Link href={`/host/listings/${data.listing.id}/pricing`} className="text-xs font-semibold underline underline-offset-4">Review pricing</Link></div>
        {data.comparableListings.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{data.comparableListings.map((listing) => <article key={listing.id} className="flex items-center gap-3 rounded-2xl border border-zinc-100 p-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">{listing.photo && <Image src={listing.photo} alt="" width={48} height={48} className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-zinc-950">{listing.title}</p><p className="mt-1 text-[11px] text-zinc-500">{listing.amenities.length} amenities · {listing.cancellationPolicy || "Policy not specified"}</p></div><p className="text-sm font-bold text-zinc-950">{formatMoney(listing.nightlyPriceCents)}</p></article>)}</div> : <p className="mt-5 text-sm text-zinc-600">{data.advancedComparison.status === "LOCKED" ? data.advancedComparison.message : "No eligible comparable listings were observed for this stay."}</p>}
        <div className="mt-5 rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-semibold text-zinc-900">Cancellation terms</p><p className="mt-1 text-xs text-zinc-600">Your policy: {data.cancellationComparison.yourPolicy || "Not specified"}. {data.cancellationComparison.message}</p>{data.cancellationComparison.comparablePolicies.length > 0 && <p className="mt-2 text-xs text-zinc-600">Similar listings: {data.cancellationComparison.comparablePolicies.map((item) => `${item.policy} (${item.count})`).join(" · ")}</p>}</div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><p className="text-[11px] text-zinc-500">{label}</p><p className="mt-1 text-lg font-bold text-zinc-950">{value}</p></div>;
}
