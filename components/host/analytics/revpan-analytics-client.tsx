"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { HostEarningsAnalyticsData } from "@/services/host-earnings-analytics.service";
import {
  FinancialKPICard,
  DonutBreakdownChart,
} from "@/components/host/analytics";

interface RevpanAnalyticsClientProps {
  data: HostEarningsAnalyticsData;
  backHref: string;
}

const fmt = (cents: number | null, currency = "SAR") => {
  if (cents === null) return "—";
  const val = Math.round(cents / 100);
  return `${currency} ${val.toLocaleString("en-US")}`;
};

export function RevpanAnalyticsClient({
  data,
  backHref,
}: RevpanAnalyticsClientProps) {
  const currency = data.currency || "SAR";

  const revpanDelta = useMemo(() => {
    if (
      data.revpan.valueCents === null ||
      data.revpan.previousValueCents === null
    ) {
      return null;
    }
    const diff = data.revpan.valueCents - data.revpan.previousValueCents;
    if (data.revpan.previousValueCents <= 0) {
      return null;
    }
    return Math.round((diff / data.revpan.previousValueCents) * 100);
  }, [data.revpan]);
  const occupancyDelta = useMemo(() => {
    const previous = data.revpan.previousOccupancyRatePercentage;
    if (previous <= 0) return null;
    return Math.round(
      ((data.revpan.occupancyRatePercentage - previous) / previous) * 100,
    );
  }, [data.revpan]);

  const maxPropertyRevpan = Math.max(
    1,
    ...data.properties.map((p) => p.revpanCents || 0),
  );

  return (
    <div className="space-y-8">
      {/* ── 1. Top Header & Navigation ── */}
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 underline underline-offset-4 transition"
        >
          <span aria-hidden="true">←</span>
          <span>Back to Advanced Earnings Analytics</span>
        </Link>

        <div className="mt-4 border-b border-zinc-200/80 pb-5">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-800">
            DASHBOARD PLUS · PROPERTY EFFICIENCY
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950">
            Revenue per available night (RevPAN)
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 font-normal leading-relaxed max-w-3xl">
            Eligible accommodation revenue divided by bookable inventory nights.
            Owner-blocked nights and paused dates are excluded under the shared
            Host Dashboard inventory policy.
          </p>
        </div>
      </div>

      {/* ── 2. Top 4 Efficiency KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: RevPAN */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          label="Current RevPAN"
          value={fmt(data.revpan.valueCents, currency)}
          percentageChange={revpanDelta}
          subtitle={`Previous: ${fmt(data.revpan.previousValueCents, currency)}`}
        />

        {/* KPI 2: Occupancy Rate */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          }
          label="Occupancy Rate"
          value={`${data.revpan.occupancyRatePercentage}%`}
          percentageChange={occupancyDelta}
          subtitle={`${data.revpan.bookedNights} booked of ${data.revpan.bookableNights} bookable`}
        />

        {/* KPI 3: Average Daily Rate (ADR) */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
          label="Average Realized Nightly Rate"
          value={fmt(data.revenue.averageRealizedNightlyRateCents, currency)}
          subtitle="Realized rate per booked night"
        />

        {/* KPI 4: Bookable Inventory */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
          label="Bookable Inventory Nights"
          value={data.revpan.bookableNights}
          subtitle={`${data.revpan.availableNights} unbooked available nights`}
        />
      </div>

      {/* ── 3. Performance Breakdown (Main RevPAN Banner & Inventory Card) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Premium Hero Banner */}
        <div className="lg:col-span-7 relative overflow-hidden rounded-3xl bg-zinc-950 p-6 sm:p-8 text-white flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-medium uppercase tracking-wider">
              <span>{data.reportingPeriod.label}</span>
              <span>·</span>
              <span>EFFICIENCY BENCHMARK</span>
            </div>

            <div className="mt-6 flex items-baseline gap-4">
              <span className="text-4xl sm:text-5xl font-medium tracking-tight text-white">
                {fmt(data.revpan.valueCents, currency)}
              </span>
              <span className="text-xs text-zinc-400 font-normal">
                per bookable night
              </span>
            </div>

            <p className="mt-3 text-xs sm:text-sm text-zinc-300 font-normal leading-relaxed max-w-lg">
              RevPAN combines your pricing power with listing utilization. It reveals
              how effectively each bookable calendar night is monetized, regardless
              of length of stay.
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-zinc-800">
              <div>
                <span className="text-[10px] text-zinc-400 font-normal block">
                  Accommodation
                </span>
                <span className="text-sm font-medium text-white block mt-0.5">
                  {fmt(data.revenue.eligibleAccommodationRevenueCents, currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 font-normal block">
                  Booked Nights
                </span>
                <span className="text-sm font-medium text-white block mt-0.5">
                  {data.revpan.bookedNights} nights
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 font-normal block">
                  Unbooked Nights
                </span>
                <span className="text-sm font-medium text-white block mt-0.5">
                  {data.revpan.availableNights} nights
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-normal">
            <span>{data.reportingPeriod.comparisonLabel}</span>
            <span>Policy: bookable eligible inventory</span>
          </div>
        </div>

        {/* Right: Inventory Relationship Card */}
        <div className="lg:col-span-5 rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-zinc-950">
                Inventory relationship
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500 font-normal">
              Booked vs available capacity breakdown
            </p>

            <div className="mt-5 flex items-center justify-center">
              <DonutBreakdownChart
                segments={[
                  {
                    label: "Booked",
                    amount: data.revpan.bookedNights,
                    percentage: data.revpan.occupancyRatePercentage,
                    color: "#F5D061",
                  },
                  {
                    label: "Unbooked Available",
                    amount: data.revpan.availableNights,
                    percentage: Math.max(0, 100 - data.revpan.occupancyRatePercentage),
                    color: "#F4F4F5",
                  },
                ]}
                centerLabel={`${data.revpan.occupancyRatePercentage}%`}
                centerSubtitle="Occupied"
                size={110}
                strokeWidth={9}
              />
            </div>

            <div className="mt-6 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600 font-normal">Eligible accommodation revenue</span>
                <span className="font-medium text-zinc-950">
                  {fmt(data.revenue.eligibleAccommodationRevenueCents, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600 font-normal">Booked nights</span>
                <span className="font-medium text-zinc-950">{data.revpan.bookedNights}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600 font-normal">Unbooked available nights</span>
                <span className="font-medium text-zinc-950">{data.revpan.availableNights}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-600 font-normal">Total bookable inventory</span>
                <span className="font-medium text-zinc-950">{data.revpan.bookableNights}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 text-xs text-zinc-400 font-normal">
            Denominator excludes host-blocked dates
          </div>
        </div>
      </div>

      {/* ── 4. Property Breakdown: RevPAN by Listing Table ── */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800">
              Property Performance
            </span>
            <h2 className="mt-1 text-base sm:text-lg font-medium text-zinc-950">
              RevPAN by listing
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 font-normal">
              Compare revenue per available night across your portfolio.
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-normal">
            {data.properties.length} listing{data.properties.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-zinc-50/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="py-3 px-4 font-medium">Listing</th>
                <th className="py-3 px-4 font-medium">Accommodation</th>
                <th className="py-3 px-4 font-medium">Bookable Nights</th>
                <th className="py-3 px-4 font-medium">Booked Nights</th>
                <th className="py-3 px-4 font-medium">Occupancy</th>
                <th className="py-3 px-4 font-medium">ADR</th>
                <th className="py-3 px-4 font-medium">RevPAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.properties.map((p) => {
                const revpanPct = Math.min(
                  100,
                  Math.max(4, ((p.revpanCents || 0) / maxPropertyRevpan) * 100),
                );

                return (
                  <tr key={p.listingId} className="hover:bg-zinc-50/60 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/80">
                          {p.coverPhotoUrl ? (
                            <Image
                              src={p.coverPhotoUrl}
                              alt={p.title}
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center text-zinc-400 bg-zinc-100">
                              🏠
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <span className="font-medium text-zinc-950 truncate block leading-tight">
                            {p.title}
                          </span>
                          {p.location && (
                            <span className="text-[11px] text-zinc-500 font-normal truncate block mt-0.5">
                              {p.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-zinc-900">
                      {fmt(p.eligibleAccommodationRevenueCents, currency)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-zinc-600 font-normal">
                      {p.bookableNights}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-zinc-600 font-normal">
                      {p.bookedNights}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-zinc-900">
                      {p.occupancyRatePercentage}%
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-zinc-900">
                      {fmt(p.averageRealizedNightlyRateCents, currency)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-amber-800 w-14">
                          {fmt(p.revpanCents, currency)}
                        </span>
                        <div className="w-12 h-1.5 rounded-full bg-zinc-100 overflow-hidden shrink-0">
                          <div
                            style={{ width: `${revpanPct}%` }}
                            className="h-full rounded-full bg-amber-400"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
