"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { GuestInsightsOverviewData } from "@/services/host-guest-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

interface HostGuestOriginsClientProps {
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

export function HostGuestOriginsClient({ initialData }: HostGuestOriginsClientProps) {
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
        if (!res.ok) throw new Error(payload?.error?.message || "Failed to update origin data.");
        if (payload.data) {
          setData(payload.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load origin data.");
      }
    });
  };

  const { origins } = data;

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={guestInsightsHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
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
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs focus:border-zinc-900 focus:outline-hidden"
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
            className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs focus:border-zinc-900 focus:outline-hidden"
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Header Banner */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="border-b border-zinc-100 pb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Demographic Origins</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">Guest Origins & Top Cities</h1>
          <p className="mt-1 text-xs text-zinc-500 max-w-xl">
            Where your guests travel from based on verified residential address data on completed reservations.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-8 text-xs text-zinc-600">
          <div>
            <span className="text-zinc-400">Total Origin Countries:</span>{" "}
            <span className="font-medium text-zinc-950">{origins.countries.length}</span>
          </div>
          <div>
            <span className="text-zinc-400">Known Origin Guests:</span>{" "}
            <span className="font-medium text-zinc-950">{origins.totalGuestsWithKnownOrigin}</span>
          </div>
          {origins.unknownOriginGuestsCount > 0 && (
            <div>
              <span className="text-zinc-400">Stays with Unknown Origin:</span>{" "}
              <span className="font-medium text-zinc-950">{origins.unknownOriginGuestsCount}</span>
            </div>
          )}
        </div>
      </section>

      {/* Origin Countries & City Breakdown List */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <h2 className="text-lg font-medium text-zinc-950">Origin Countries & Cities Breakdown</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Ranked by total guest share</p>

        {origins.countries.length > 0 ? (
          <div className="mt-6 divide-y divide-zinc-100">
            {origins.countries.map((c, idx) => (
              <div key={c.country} className="py-5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700">
                      {idx + 1}
                    </span>
                    <h3 className="text-base font-medium text-zinc-950">{c.country}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-medium text-zinc-950 font-mono">{c.sharePercentage}%</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      ({c.guestCount} {c.guestCount === 1 ? "guest" : "guests"})
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                    style={{ width: `${Math.min(100, c.sharePercentage)}%` }}
                  />
                </div>

                {/* Top Cities */}
                {c.topCities.length > 0 && (
                  <div className="mt-4 pl-9">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Top Origin Cities</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.topCities.map((city) => (
                        <span
                          key={city.city}
                          className="rounded-full bg-zinc-50 border border-zinc-200/80 px-3 py-1 text-xs font-medium text-zinc-800"
                        >
                          {city.city} · <span className="font-medium text-zinc-950">{city.sharePercentage}%</span> ({city.guestCount})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-zinc-500">
            No guest origin records available for this reporting window.
          </div>
        )}
      </section>

      {/* Origin Data Integrity Notice */}
      <section className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-6 shadow-xs">
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-700">Data Integrity & Privacy Policy</h4>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Guest origins are derived exclusively from verified residential profiles provided during booking.
          In accordance with platform security and privacy policies, guest origins are never inferred from IP addresses or device telemetry,
          and individual identity records are aggregated into group shares.
        </p>
      </section>
    </div>
  );
}
