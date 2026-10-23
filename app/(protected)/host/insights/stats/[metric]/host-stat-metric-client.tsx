"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import type { StatMetricDetailData } from "@/services/host-stats-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

interface HostStatMetricClientProps {
  initialData: StatMetricDetailData;
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

export function HostStatMetricClient({ initialData }: HostStatMetricClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { currency: globalDisplayCurrency } = useCurrency();
  const prevGlobalCurrency = useRef(globalDisplayCurrency);

  const [data, setData] = useState<StatMetricDetailData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const statsHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "stats");
    return `/host/insights?${params.toString()}`;
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
        const res = await fetch(`/api/v1/host/insights/stats/${data.metric}?${next.toString()}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error?.message || "Failed to update metric data.");
        if (payload.data) {
          setData(payload.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load metric data.");
      }
    });
  };

  // Real-time synchronization: when the user changes main currency in the global "Languages & currency" modal
  useEffect(() => {
    if (globalDisplayCurrency && prevGlobalCurrency.current !== globalDisplayCurrency) {
      prevGlobalCurrency.current = globalDisplayCurrency;
      updateFilters({ currency: globalDisplayCurrency });
    }
  }, [globalDisplayCurrency]);

  // Find max value in trend for proportional SVG chart heights
  const trendMax = Math.max(
    ...data.trend.map((t) => (typeof t.value === "number" ? t.value : 0)),
    1,
  );

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={statsHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950"
        >
          <span className="text-base">←</span>
          <span>Back to Stats</span>
        </Link>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Listing Selector */}
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

          {/* Period Selector */}
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

          {/* Active Currency Badge */}
          {data.currency && (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs">
              {data.currency}
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Metric Header & Overview */}
      <section className={`rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-zinc-100 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Metric Details</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">{data.title}</h1>
            <p className="mt-1 text-xs text-zinc-500 max-w-xl">{data.subtitle}</p>
          </div>
          <Link
            href={data.action.href}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800 sm:mt-0"
          >
            <span>{data.action.label}</span>
            <span>→</span>
          </Link>
        </div>

        {/* Current vs Previous Comparison Hero */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">{data.reportingPeriod.label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              {data.formattedCurrentValue}
            </p>
            {data.deltaPercentage !== null && (
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] ${
                    data.deltaDirection === "increase"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                      : data.deltaDirection === "decrease"
                        ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20"
                        : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {data.deltaDirection === "increase" ? "↑" : data.deltaDirection === "decrease" ? "↓" : "•"}
                  <span>{Math.abs(data.deltaPercentage)}%</span>
                </span>
                <span className="text-zinc-500">{data.comparisonLabel}</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
            <p className="text-xs text-zinc-500">Comparison Period ({data.comparisonLabel})</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-700">
              {data.formattedPreviousValue}
            </p>
            <p className="mt-3 text-[11px] text-zinc-500">
              Evaluated over the preceding equivalent date window
            </p>
          </div>

          {data.benchmark && (
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
              <p className="text-xs text-zinc-500">{data.benchmark.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">
                {data.benchmark.target}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    data.benchmark.isMet
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                      : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                  }`}
                >
                  {data.benchmark.isMet ? "✓ Benchmark Met" : "Target Not Met"}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Historical Trend Chart Section */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-950">Historical Performance Trend</h2>
            <p className="text-xs text-zinc-500">Monthly progression across the past year</p>
          </div>
          <span className="text-xs text-zinc-400 font-mono">12-Month Window</span>
        </div>

        {data.trend.length > 0 ? (
          <div className="mt-8">
            {/* SVG Visual Bars Chart */}
            <div className="flex h-44 items-end gap-2 border-b border-zinc-100 pb-2 sm:gap-4">
              {data.trend.map((point) => {
                const val = typeof point.value === "number" ? point.value : 0;
                const heightPct = trendMax > 0 ? Math.max(6, Math.round((val / trendMax) * 100)) : 6;

                return (
                  <div key={point.periodKey} className="group relative flex flex-1 flex-col items-center h-full justify-end">
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-10 z-10 hidden rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white shadow-xs group-hover:block whitespace-nowrap">
                      {point.label}: {point.value !== null ? point.value.toLocaleString() : "—"}{" "}
                      {data.unit}
                    </div>

                    {/* Bar */}
                    <div
                      className="w-full max-w-[42px] rounded-t-md bg-zinc-900 transition-all duration-300 group-hover:bg-zinc-700"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase text-zinc-500">
              {data.trend.map((point) => (
                <span key={point.periodKey} className="truncate px-0.5">
                  {point.label.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-zinc-500">
            {data.instrumentationStatus ? data.instrumentationStatus.message : "No trend records available for this period."}
          </div>
        )}
      </section>

      {/* Property Breakdown Section */}
      {data.propertyBreakdown.length > 0 && (
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-lg font-bold text-zinc-950">Property-level breakdown</h2>
          <p className="text-xs text-zinc-500">Performance across authorized listings</p>

          <div className="mt-6 divide-y divide-zinc-100">
            {data.propertyBreakdown.map((item) => (
              <div key={item.listingId} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div>
                  <Link
                    href={`/host/listings/${item.listingId}`}
                    className="text-sm font-semibold text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                  >
                    {item.listingTitle}
                  </Link>
                  {item.secondaryLabel && (
                    <p className="text-[11px] text-zinc-500">{item.secondaryLabel}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-zinc-950 font-mono">{item.formattedValue}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Supporting Metrics Section */}
      {data.supportingMetrics.length > 0 && (
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-lg font-bold text-zinc-950">Supporting data & calculation context</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.supportingMetrics.map((sm) => (
              <div key={sm.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <p className="text-xs font-semibold text-zinc-600">{sm.label}</p>
                <p className="mt-1 text-xl font-bold text-zinc-950">{sm.value}</p>
                {sm.description && <p className="mt-1.5 text-[11px] text-zinc-500">{sm.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Telemetry Disclosure Notice if Uninstrumented */}
      {data.instrumentationStatus && (
        <section className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-6 shadow-xs">
          <h3 className="text-sm font-bold text-zinc-900">Data Integrity Notice</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            {data.instrumentationStatus.message}
          </p>
        </section>
      )}
    </div>
  );
}
