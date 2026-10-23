"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { GuestInsightsOverviewData } from "@/services/host-guest-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

interface HostCheckInEngagementClientProps {
  initialData: GuestInsightsOverviewData;
}

const PERIOD_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "last_12_months", label: "Last 12 Months" },
  { value: "year_to_date", label: "Year to Date" },
];

export function HostCheckInEngagementClient({ initialData }: HostCheckInEngagementClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<GuestInsightsOverviewData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const guestInsightsHref = (() => {
    const query = searchParams.toString();
    return query ? `/host/insights/stats/guests?${query}` : "/host/insights/stats/guests";
  })();

  const updateFilters = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

    startTransition(async () => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      setError(null);
      try {
        const res = await fetch(`/api/v1/host/insights/guests?${next.toString()}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error?.message || "Failed to update check-in data.");
        if (payload.data) {
          setData(payload.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load check-in data.");
      }
    });
  };

  const { checkInEngagement } = data;

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={guestInsightsHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950"
        >
          <span className="text-base">←</span>
          <span>Back to Guest Insights</span>
        </Link>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {data.listings.length > 1 && (
            <select
              value={data.selectedListingId || "all"}
              onChange={(e) => updateFilters({ propertyId: e.target.value === "all" ? null : e.target.value })}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs focus:border-zinc-900 focus:outline-hidden"
              disabled={isPending}
            >
              <option value="all">All properties</option>
              {data.listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          )}

          <select
            value={data.reportingPeriod.preset}
            onChange={(e) => updateFilters({ period: e.target.value })}
            className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs focus:border-zinc-900 focus:outline-hidden"
            disabled={isPending}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Header Banner */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="border-b border-zinc-100 pb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Guest Experience</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">Check-in Instructions Engagement</h1>
          <p className="mt-1 text-xs text-zinc-500 max-w-xl">
            Tracks whether guests open and view their arrival check-in instructions before checking in. Higher viewing rates reduce host messaging friction and arrival confusion.
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">Viewed Percentage</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              {checkInEngagement.viewedPercentage}%
            </p>
            <p className="mt-3 text-[11px] text-zinc-500">
              {checkInEngagement.viewedCount} of {checkInEngagement.eligibleReservationsCount} eligible stays viewed
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">Viewed by Guest</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-800 sm:text-4xl">
              {checkInEngagement.viewedCount}
            </p>
            <p className="mt-3 text-[11px] text-zinc-500">Opened arrival details</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">Not Yet Opened</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-700 sm:text-4xl">
              {checkInEngagement.notViewedCount}
            </p>
            <p className="mt-3 text-[11px] text-zinc-500">Arrival details pending view</p>
          </div>
        </div>
      </section>

      {/* Property Breakdown Section */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <h2 className="text-lg font-bold text-zinc-950">Property-level Check-in Viewing</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Instruction engagement across your properties</p>

        {checkInEngagement.propertyBreakdown.length > 0 ? (
          <div className="mt-6 divide-y divide-zinc-100">
            {checkInEngagement.propertyBreakdown.map((item) => (
              <div key={item.listingId} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div>
                  <Link
                    href={`/host/listings/${item.listingId}`}
                    className="text-sm font-semibold text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                  >
                    {item.listingTitle}
                  </Link>
                  <p className="text-[11px] text-zinc-500">
                    {item.viewedCount} of {item.eligibleCount} reservations viewed
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-zinc-950 font-mono">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-zinc-500">
            No properties found with check-in instructions configured.
          </div>
        )}
      </section>

      {/* Telemetry Tracking Disclosure */}
      <section className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-6 shadow-xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Event Telemetry Status</h4>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          {checkInEngagement.trackingStatus.message}
          {checkInEngagement.trackingStatus.trackingStartDate ? <>
            {" "}Telemetry tracking was provisioned on {new Date(checkInEngagement.trackingStatus.trackingStartDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
          </> : " Tracking will be dated once instrumentation is configured."}
          Repeated views by the same guest on a single reservation are deduplicated for reservation-level reporting integrity.
        </p>
      </section>
    </div>
  );
}
