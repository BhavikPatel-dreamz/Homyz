"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { GuestInsightsOverviewData } from "@/services/host-guest-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

interface HostGuestInsightsClientProps {
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

export function HostGuestInsightsClient({ initialData }: HostGuestInsightsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<GuestInsightsOverviewData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const withCurrentFilters = (href: string) => {
    const target = new URL(href, "https://homyz.local");
    searchParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });
    return `${target.pathname}${target.search}`;
  };

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
        if (!res.ok) throw new Error(payload?.error?.message || "Failed to update guest data.");
        if (payload.data) {
          setData(payload.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load guest data.");
      }
    });
  };

  const { summary, origins, returning, checkInEngagement } = data;
  const formatMoney = (cents: number | null, currency: string) => cents === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={withCurrentFilters("/host/insights?tab=stats")}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
        >
          <span className="text-base">←</span>
          <span>Back to Stats</span>
        </Link>

        {/* Filters */}
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
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Audience & Demographics</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">Guest Insights</h1>
          <p className="mt-1 text-xs text-zinc-500 max-w-xl">
            Understand where your guests come from, how often they return, and how they engage with your listings.
          </p>
        </div>

        {/* 5 Main Summary Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1. Total Unique Guests */}
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <p className="text-xs text-zinc-500">Total Unique Guests</p>
            <p className="mt-1 text-2xl font-medium tracking-tight text-zinc-950">{summary.uniqueGuestsCount}</p>
            <p className="mt-2 text-[11px] text-zinc-500">{summary.completedGuestStaysCount} stays completed</p>
          </div>

          {/* 2. Origin Countries */}
          <Link
            href={withCurrentFilters("/host/insights/stats/guests/origins")}
            className="group rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 transition-all hover:border-zinc-300 hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 group-hover:text-zinc-900">Origin Countries</p>
              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-950">→</span>
            </div>
            <p className="mt-1 text-2xl font-medium tracking-tight text-zinc-950">{summary.originCountriesCount}</p>
            <p className="mt-2 text-[11px] text-zinc-500">View country origins</p>
          </Link>

          {/* 3. Returning Guests % */}
          <Link
            href={withCurrentFilters("/host/insights/stats/guests/returning")}
            className="group rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 transition-all hover:border-zinc-300 hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 group-hover:text-zinc-900">Returning Guests</p>
              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-950">→</span>
            </div>
            <p className="mt-1 text-2xl font-medium tracking-tight text-zinc-950">{summary.returningGuestsPercentage}%</p>
            <p className="mt-2 text-[11px] text-zinc-500">{summary.returningGuestsCount} repeat guests</p>
          </Link>

          {/* 4. Guest Rating Indicator */}
          <Link
            href={withCurrentFilters("/host/insights?tab=reviews")}
            className="group rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 transition-all hover:border-zinc-300 hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 group-hover:text-zinc-900">Average Rating</p>
              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-950">→</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-medium tracking-tight text-zinc-950">
                {summary.averageRatingReceived !== null ? summary.averageRatingReceived.toFixed(2) : "—"}
              </span>
              <span className="text-amber-500 text-sm">★</span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">{summary.totalReviewsCount} guest reviews</p>
          </Link>

          {/* 5. Check-In Instructions Viewed */}
          <Link
            href={withCurrentFilters("/host/insights/stats/guests/check-in")}
            className="group rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 transition-all hover:border-zinc-300 hover:bg-white"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 group-hover:text-zinc-900">Check-in Viewed</p>
              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-950">→</span>
            </div>
            <p className="mt-1 text-2xl font-medium tracking-tight text-zinc-950">
              {summary.checkInInstructionsViewedPercentage !== null
                ? `${summary.checkInInstructionsViewedPercentage}%`
                : "Active"}
            </p>
            <p className="mt-2 text-[11px] text-zinc-500">Verified arrival views</p>
          </Link>
        </div>
      </section>

      {/* Guest Origins (Last 6 Months) Overview Card */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-lg font-medium text-zinc-950">Guest Origins (Last 6 Months)</h2>
            <p className="text-xs text-zinc-500">Distribution of distinct guests with verified stays</p>
          </div>
          <Link
            href={withCurrentFilters("/host/insights/stats/guests/origins")}
            className="text-xs font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
          >
            See full origin details →
          </Link>
        </div>

        {origins.countries.length > 0 ? (
          <div className="mt-6 space-y-4">
            {origins.countries.slice(0, 5).map((country) => (
              <div key={country.country} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-900">
                  <span className="flex items-center gap-2">
                    <span>{country.country}</span>
                    {country.topCities.length > 0 && (
                      <span className="text-[11px] font-normal text-zinc-500">
                        ({country.topCities.map((c) => c.city).slice(0, 2).join(", ")})
                      </span>
                    )}
                  </span>
                  <span className="font-mono">
                    {country.sharePercentage}% ({country.guestCount} {country.guestCount === 1 ? "guest" : "guests"})
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                    style={{ width: `${Math.min(100, country.sharePercentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-zinc-500">
            No guest origin records recorded yet for this period.
          </div>
        )}
      </section>

      {/* Returning Guests & Check-In Row */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Returning Guests Cohort Card */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-lg font-medium text-zinc-950">Returning Guests</h2>
              <p className="text-xs text-zinc-500">Guests with 2+ completed reservations</p>
            </div>
            <Link
              href={withCurrentFilters("/host/insights/stats/guests/returning")}
              className="text-xs font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
            >
              Cohort details →
            </Link>
          </div>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-4xl font-medium tracking-tight text-zinc-950 sm:text-5xl">
              {returning.returningPercentage}%
            </span>
            <span className="text-xs text-zinc-500">
              ({returning.returningGuests} of {returning.totalGuests} guests)
            </span>
          </div>

          <div className="mt-6 space-y-2.5 border-t border-zinc-100 pt-5">
            {returning.repeatStayBreakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 font-medium">{item.category}</span>
                <span className="font-mono font-medium text-zinc-950">
                  {item.percentage}% ({item.guestCount})
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-5 text-xs">
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-zinc-500">Repeat bookings</p><p className="mt-1 font-medium text-zinc-950">{returning.repeatBookingCount}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-zinc-500">Observed repeat value</p><p className="mt-1 font-medium text-zinc-950">{formatMoney(returning.realizedRepeatGuestRevenueCents, returning.currency)}</p></div>
          </div>
        </section>

        {/* Check-In Instruction Engagement Card */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-lg font-medium text-zinc-950">Check-In Instructions Engagement</h2>
              <p className="text-xs text-zinc-500">Verified arrival instructions viewing status</p>
            </div>
            <Link
              href={withCurrentFilters("/host/insights/stats/guests/check-in")}
              className="text-xs font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
            >
              Engagement details →
            </Link>
          </div>

          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-zinc-700">Viewed by guests</span>
              <span className="text-xl font-medium text-zinc-950 font-mono">
                {checkInEngagement.viewedPercentage}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-900"
                style={{ width: `${checkInEngagement.viewedPercentage}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                <p className="text-zinc-500">Viewed before arrival</p>
                <p className="mt-1 font-medium text-zinc-950">{checkInEngagement.viewedCount} stays</p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                <p className="text-zinc-500">Not yet opened</p>
                <p className="mt-1 font-medium text-zinc-950">{checkInEngagement.notViewedCount} stays</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="border-b border-zinc-100 pb-4"><h2 className="text-lg font-medium text-zinc-950">Trip purpose</h2><p className="mt-1 text-xs text-zinc-500">{data.tripPurpose.message}</p></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.tripPurpose.items.map((item) => <div key={item.purpose} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4"><div className="flex justify-between gap-3"><p className="text-sm font-medium text-zinc-900">{item.label}</p><p className="text-sm font-medium text-zinc-950">{item.percentage}%</p></div><p className="mt-3 text-2xl font-medium tracking-tight text-zinc-950">{item.bookingCount}</p><p className="mt-1 text-[11px] text-zinc-500">{item.averageStayNights === null ? "No completed stays" : `${item.averageStayNights} avg. nights`} · {formatMoney(item.eligibleRevenueCents, data.tripPurpose.currency)} eligible revenue</p></div>)}
        </div>
      </section>
    </div>
  );
}
