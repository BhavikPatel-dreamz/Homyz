"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { GuestInsightsOverviewData } from "@/services/host-guest-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

interface HostReturningGuestsClientProps {
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

export function HostReturningGuestsClient({ initialData }: HostReturningGuestsClientProps) {
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
        if (!res.ok) throw new Error(payload?.error?.message || "Failed to update returning guest data.");
        if (payload.data) {
          setData(payload.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load returning guest data.");
      }
    });
  };

  const { returning } = data;

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
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Cohort Analysis</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">Returning Guests Cohorts</h1>
          <p className="mt-1 text-xs text-zinc-500 max-w-xl">
            Guests who have completed 2 or more reservations across your properties. Repeat bookings demonstrate guest loyalty and high stay satisfaction.
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">Returning Guest Rate</p>
            <p className="mt-2 text-3xl font-medium tracking-tight text-zinc-950 sm:text-4xl">
              {returning.returningPercentage}%
            </p>
            <p className="mt-3 text-[11px] text-zinc-500">{returning.returningGuests} returning of {returning.totalGuests} unique guests</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">First-Time Guests</p>
            <p className="mt-2 text-3xl font-medium tracking-tight text-zinc-950 sm:text-4xl">
              {returning.firstTimeGuests}
            </p>
            <p className="mt-3 text-[11px] text-zinc-500">Guests on their initial stay</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">Repeat Guests (2+ stays)</p>
            <p className="mt-2 text-3xl font-medium tracking-tight text-zinc-950 sm:text-4xl">
              {returning.returningGuests}
            </p>
            <p className="mt-3 text-[11px] text-zinc-500">Repeat and loyal guest count</p>
          </div>
        </div>
      </section>

      {/* Cohort Breakdown & Frequency */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <h2 className="text-lg font-medium text-zinc-950">Stay Frequency Breakdown</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Distribution of guests by cumulative completed stays</p>

        <div className="mt-6 space-y-4">
          {returning.repeatStayBreakdown.map((item) => (
            <div key={item.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-900">
                <span>{item.category}</span>
                <span className="font-mono">
                  {item.percentage}% ({item.guestCount} {item.guestCount === 1 ? "guest" : "guests"})
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                  style={{ width: `${Math.min(100, item.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Historical Trend Chart */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-lg font-medium text-zinc-950">6-Month Returning Guest Trend</h2>
            <p className="text-xs text-zinc-500">Monthly progression of repeat stay activity</p>
          </div>
          <span className="text-xs text-zinc-400 font-mono">Rolling 6 Months</span>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {returning.trend.map((t) => (
            <div key={t.monthKey} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3.5 text-center">
              <p className="text-[10px] font-medium uppercase text-zinc-500">{t.label.split(" ")[0]}</p>
              <p className="mt-1 text-base font-medium text-zinc-950 font-mono">{t.returningPercentage}%</p>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                {t.returningGuestsCount} of {t.totalGuestsCount} guests
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
