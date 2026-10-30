"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type DatePeriodPickerState,
} from "@/components/host/reporting/date-period-picker";
import {
  PeriodComparisonModal,
  type ComparisonPeriodConfig,
} from "@/components/host/reporting/period-comparison-modal";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";
import type { HostEarningsAnalyticsData } from "@/services/host-earnings-analytics.service";
import {
  AnalyticsPageHeader,
  FinancialKPICard,
  PercentageChangeBadge,
  RevenueTrendChart, // Premium interactive chart matching EarningsInteractiveChart specification
  FinancialWaterfallChart,
  PropertyComparisonTable,
  AddExpenseModal,
  ExpenseHistoryDrawer,
} from "@/components/host/analytics";

const fmt = (cents: number | null, currency = "SAR") => {
  if (cents === null) return "—";
  const val = Math.round(cents / 100);
  return `${currency} ${val.toLocaleString("en-US")}`;
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const formatExpenseDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));

function reportingRange(value: DatePeriodPickerState) {
  const now = new Date();
  const year = value.year || now.getUTCFullYear();
  const month = value.month || now.getUTCMonth() + 1;
  const oneDay = (date: string) => ({ startDate: date, endDate: date });

  if (value.timeframe === "daily" && value.date) return oneDay(value.date);
  if (value.timeframe === "weekly") {
    const startDate = value.weekStart || value.date || isoDate(now);
    const end = new Date(`${startDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { startDate, endDate: isoDate(end) };
  }
  if (value.timeframe === "quarterly") {
    const startMonth = ((value.quarter || 1) - 1) * 3;
    return {
      startDate: isoDate(new Date(Date.UTC(year, startMonth, 1))),
      endDate: isoDate(new Date(Date.UTC(year, startMonth + 3, 0))),
    };
  }
  if (value.timeframe === "yearly") {
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (value.timeframe === "custom" && value.startDate && value.endDate) {
    return { startDate: value.startDate, endDate: value.endDate };
  }
  return {
    startDate: isoDate(new Date(Date.UTC(year, month - 1, 1))),
    endDate: isoDate(new Date(Date.UTC(year, month, 0))),
  };
}

export function HostEarningsAnalyticsClient({
  initialData,
}: {
  initialData: HostEarningsAnalyticsData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers state
  const [showComparison, setShowComparison] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isExpenseHistoryOpen, setIsExpenseHistoryOpen] = useState(false);
  const [isDiffNoticeExpanded, setIsDiffNoticeExpanded] = useState(false);

  const activeRequest = useRef<AbortController | null>(null);
  const params = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );
  const queryKey = searchParams.toString();
  const lastLoadedQuery = useRef(queryKey);
  const currency = data.currency || "SAR";
  const analyticsTimeframe =
    (params.get("analyticsTimeframe") as TimeframeGranularity) ||
    (params.get("timeframe") as TimeframeGranularity) ||
    "monthly";

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (lastLoadedQuery.current === queryKey) return;
    lastLoadedQuery.current = queryKey;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/host/earnings/analytics?${queryKey}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload?.error?.message ||
              "Unable to load advanced earnings analytics.",
          );
        }
        setData(payload.data ?? payload);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load advanced earnings analytics.",
          );
        }
      } finally {
        if (activeRequest.current === controller) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [queryKey]);

  const handlePeriodChange = (next: DatePeriodPickerState) => {
    const range = reportingRange(next);
    void update({
      period: "custom",
      startDate: range.startDate,
      endDate: range.endDate,
      analyticsTimeframe: next.timeframe,
      timeframe: next.timeframe,
    });
  };

  const handleComparison = (config: ComparisonPeriodConfig | null) => {
    if (!config?.enabled) {
      void update({ comparisonStartDate: null, comparisonEndDate: null });
      return;
    }
    void update({
      comparisonStartDate: config.startDate,
      comparisonEndDate: config.endDate,
    });
  };

  const requestedYear = Number(params.get("year"));
  const requestedMonth = Number(params.get("month"));
  const today = new Date();
  const pickerYear =
    Number.isInteger(requestedYear) && requestedYear >= 2000
      ? requestedYear
      : today.getUTCFullYear();
  const pickerMonth =
    Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
      ? requestedMonth
      : today.getUTCMonth() + 1;
  const start =
    params.get("startDate") ||
    params.get("weekStart") ||
    params.get("date") ||
    isoDate(new Date(Date.UTC(pickerYear, pickerMonth - 1, 1)));
  const startDate = new Date(`${start}T00:00:00.000Z`);

  // Percentage calculations
  const calcDelta = (curr: number | null, prev: number | null) => {
    if (curr === null || prev === null) return null;
    if (prev <= 0) return null;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };

  const accommodationDelta = calcDelta(
    data.revenue.eligibleAccommodationRevenueCents,
    data.revenue.previousAccommodationRevenueCents,
  );
  const revpanDelta = calcDelta(
    data.revpan.valueCents,
    data.revpan.previousValueCents,
  );
  const revenuePerBookingDelta = calcDelta(
    data.revenue.revenuePerBookingCents,
    data.revenue.previousRevenuePerBookingCents,
  );
  const netPerBookingDelta = calcDelta(
    data.revenue.netPerBookingCents,
    data.revenue.previousNetPerBookingCents,
  );
  const completedBookingsDelta = calcDelta(
    data.revenue.qualifyingBookingsCount,
    data.revenue.previousQualifyingBookingsCount,
  );
  const occupancyDelta = calcDelta(
    data.revpan.occupancyRatePercentage,
    data.revpan.previousOccupancyRatePercentage,
  );
  const recordedCostsDelta = calcDelta(
    data.costs.totalRecordedOperatingCostsCents,
    data.costs.previousTotalRecordedOperatingCostsCents,
  );
  const costPerStayDelta = calcDelta(
    data.costs.costPerCompletedStayCents,
    data.costs.previousCostPerCompletedStayCents,
  );

  // Settlement items max for progress bar
  const maxSettlementItem = Math.max(
    1,
    data.payoutBreakdown.accommodationCents,
    data.payoutBreakdown.cleaningFeesCents,
    data.payoutBreakdown.hostServiceFeesCents,
    data.payoutBreakdown.netHostPayoutCents,
  );

  // Category breakdown for recorded costs
  const categoryPalette = ["#D97706", "#F5D061", "#94A3B8", "#1E293B", "#38BDF8"];
  const totalCostVal = data.costs.totalRecordedOperatingCostsCents || 1;
  const costSegments = data.costs.categoryBreakdown.map((item, idx) => ({
    label: item.category.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    amount: item.amountCents,
    percentage: Math.round((item.amountCents / totalCostVal) * 100),
    color: categoryPalette[idx % categoryPalette.length],
  }));
  const unattributedSource = data.bookingSources.sources[0];
  const unattributedPercentage = unattributedSource?.contributionPercentage ?? null;

  const refreshExpenses = () => {
    void update({ expensesUpdated: String(Date.now()) });
  };

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8" aria-busy={loading}>
      {/* ── 1. Page Header & Global Filters ── */}
      <AnalyticsPageHeader
        eyebrow="DASHBOARD PLUS"
        title="Advanced Earnings Analytics"
        subtitle="Understand your revenue, profitability, and financial performance across your listings."
        listings={data.listings}
        selectedListingId={data.selectedListingId}
        onListingChange={(id) => void update({ propertyId: id, propertyPage: "1" })}
        periodPickerState={{
          timeframe: analyticsTimeframe,
          date: params.get("date") || undefined,
          weekStart: params.get("weekStart") || undefined,
          month: startDate.getUTCMonth() + 1,
          year: startDate.getUTCFullYear(),
          quarter: Math.floor(startDate.getUTCMonth() / 3) + 1,
          startDate: params.get("startDate") || undefined,
          endDate: params.get("endDate") || undefined,
        }}
        onPeriodChange={handlePeriodChange}
        periodDisplayLabel={data.reportingPeriod.label}
        onOpenCompare={() => setShowComparison(true)}
        hasActiveComparison={Boolean(params.get("comparisonStartDate"))}
        onClearComparison={() => handleComparison(null)}
        loading={loading}
      />

      {/* Error alert if any */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void update({ retry: String(Date.now()) })}
            className="underline underline-offset-4 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 2. SECTION 1: Actual Realized Revenue Card with Bar Chart ── */}
      <RevenueTrendChart
        trend={data.trend}
        currentNetCents={data.revenue.netHostEarningsCents}
        previousNetCents={data.revenue.previousNetHostEarningsCents}
        currency={currency}
        periodLabel={data.reportingPeriod.label}
        comparisonLabel={data.reportingPeriod.comparisonLabel}
      />

      {/* ── 3. SECTION 2: Four Financial KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Accommodation revenue */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
          label="Accommodation revenue"
          value={fmt(data.revenue.eligibleAccommodationRevenueCents, currency)}
          percentageChange={accommodationDelta}
          subtitle="Completed-stay accommodation subtotal"
        />

        {/* KPI 2: Completed bookings */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
          label="Completed bookings"
          value={data.revenue.qualifyingBookingsCount}
          percentageChange={completedBookingsDelta}
          subtitle="Eligible completed stays"
        />

        {/* KPI 3: Revenue per booking */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
          label="Revenue per booking"
          value={fmt(data.revenue.revenuePerBookingCents, currency)}
          percentageChange={revenuePerBookingDelta}
          subtitle="Accommodation ÷ qualifying stays"
        />

        {/* KPI 4: Net per booking */}
        <FinancialKPICard
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
            </svg>
          }
          label="Net per booking"
          value={fmt(data.revenue.netPerBookingCents, currency)}
          percentageChange={netPerBookingDelta}
          subtitle="Net payout ÷ qualifying stays"
        />
      </div>

      {/* ── 4. SECTION 3: Explanatory Notice Banner ── */}
      <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/70 p-4 sm:p-5 text-xs text-zinc-600 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="text-amber-700 text-sm mt-0.5">ℹ</span>
            <div>
              <p className="font-medium text-zinc-900 text-xs sm:text-sm">
                Why net earnings can differ from accommodation revenue?
              </p>
              <p className="mt-1 text-zinc-500 font-normal leading-relaxed">
                Net host earnings come from eligible completed-stay payout snapshots. They can differ from accommodation revenue because of host service fees, cleaning and ancillary fees, host-collected taxes, and other recorded payout components. Recorded operating costs are shown separately in estimated profit.
              </p>
              {isDiffNoticeExpanded && (
                <div className="mt-3 pt-3 border-t border-zinc-200/80 space-y-1.5 text-[11px] text-zinc-600 font-normal">
                  <p>
                    • Immutable payout snapshots include cleaning fees ({fmt(data.revenue.cleaningFeesCents, currency)}), extra-guest fees ({fmt(data.revenue.extraGuestFeesCents, currency)}), pet fees ({fmt(data.revenue.petFeesCents, currency)}), and host-collected taxes ({fmt(data.revenue.taxesCollectedForHostCents, currency)}).
                  </p>
                  <p>
                    • Platform deductions include host service fees ({fmt(data.revenue.hostServiceFeesCents, currency)}).
                  </p>
                  {data.revenue.recordedGrossBookingRevenueCents !== null && (
                    <p>
                      • Total recorded guest booking value: {fmt(data.revenue.recordedGrossBookingRevenueCents, currency)}.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDiffNoticeExpanded(!isDiffNoticeExpanded)}
            className="shrink-0 text-xs font-medium text-zinc-700 hover:text-zinc-950 underline underline-offset-4 cursor-pointer"
          >
            {isDiffNoticeExpanded ? "Show less" : "Learn more →"}
          </button>
        </div>
      </div>

      {/* ── 5. SECTION 4: Two Performance Cards (RevPAN & Occupancy) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card 4A: Revenue per available night */}
        <div className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl bg-zinc-950 p-4 text-white shadow-xs sm:p-7">
          {/* Subtle villa background on right */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2/5 opacity-15 pointer-events-none bg-cover bg-center"
            style={{
              backgroundImage:
                "radial-gradient(circle at right, rgba(245,208,97,0.3) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-800 text-amber-400">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <p className="text-xs font-medium text-zinc-300">
                Revenue per available night
              </p>
            </div>
            <p className="mt-1 text-[11px] font-normal text-zinc-400">
              Eligible accommodation revenue ÷ bookable inventory nights
            </p>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-amber-400">
                Current RevPAN
              </span>
              <span className="text-3xl sm:text-4xl font-medium tracking-tight text-white">
                {fmt(data.revpan.valueCents, currency)}
              </span>
              <PercentageChangeBadge value={revpanDelta} suffix=" vs comparison" />
            </div>

            <p className="mt-2 text-xs text-zinc-400 font-normal">
              {data.revpan.bookableNights} bookable nights · {data.revpan.bookedNights} booked · {data.revpan.availableNights} unbooked available
            </p>
          </div>

          <div className="relative z-10 mt-6 flex flex-col gap-3 border-t border-zinc-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-zinc-400">
              Previous RevPAN: {fmt(data.revpan.previousValueCents, currency)}
            </span>
            <Link
              href={`/host/earnings/analytics/revpan?${params.toString()}`}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-medium text-amber-300 transition cursor-pointer"
            >
              <span>View RevPAN details</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Card 4B: Occupancy relationship */}
        <div className="flex min-w-0 flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-zinc-900">
                  Occupancy relationship
                </h3>
              </div>
              <span className="text-xs text-zinc-400 font-normal">
                📅 {data.reportingPeriod.label}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950">
                    {data.revpan.occupancyRatePercentage}%
                  </span>
                  <PercentageChangeBadge value={occupancyDelta} suffix=" vs comparison" />
                </div>
                <p className="mt-2 text-xs text-zinc-500 font-normal leading-relaxed max-w-sm">
                  Average realized nightly rate: {fmt(data.revenue.averageRealizedNightlyRateCents, currency)}. Occupancy uses the same active-listing, confirmed-booking and blocked-night inventory policy as Host Dashboard.
                </p>
              </div>

              {/* Occupancy Donut */}
              <div className="self-center shrink-0 min-[430px]:self-auto">
                <DonutBreakdownChart
                  segments={[
                    {
                      label: "Occupied",
                      percentage: data.revpan.occupancyRatePercentage,
                      color: "#F5D061",
                    },
                    {
                      label: "Available",
                      percentage: Math.max(0, 100 - data.revpan.occupancyRatePercentage),
                      color: "#F4F4F5",
                    },
                  ]}
                  centerLabel={`${data.revpan.occupancyRatePercentage}%`}
                  centerSubtitle="Occupancy"
                  size={96}
                  strokeWidth={9}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-xs font-normal text-zinc-500 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
            <span>Previous RevPAN: {fmt(data.revpan.previousValueCents, currency)}</span>
            <span>Policy: bookable eligible inventory</span>
          </div>
        </div>
      </div>

      {/* ── 6. SECTION 5: Recorded Costs & Estimated Profit ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card 5A: Recorded costs */}
        <div className="flex min-w-0 flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-7">
          <div>
            <div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-zinc-900">
                    Recorded costs
                  </h3>
                </div>
                <p className="mt-1 text-xs text-zinc-500 font-normal">
                  {data.costs.message}
                </p>
              </div>

              {/* + Add expense button */}
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(true)}
                className="rounded-full bg-zinc-950 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-black transition cursor-pointer shrink-0"
              >
                + Add expense
              </button>
            </div>

            <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              {/* Cost stats */}
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-normal text-zinc-500 block">
                    Total recorded costs
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-950">
                      {fmt(data.costs.totalRecordedOperatingCostsCents, currency)}
                    </span>
                    <PercentageChangeBadge
                      value={recordedCostsDelta}
                      invertColors={true}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    vs comparison period
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-normal text-zinc-500 block">
                    Cost per stay
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg sm:text-xl font-medium tracking-tight text-zinc-950">
                      {fmt(data.costs.costPerCompletedStayCents, currency)}
                    </span>
                    <PercentageChangeBadge
                      value={costPerStayDelta}
                      invertColors={true}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    Completed stays
                  </span>
                </div>
              </div>

              {/* Donut with category legend */}
              <div className="flex-1">
                <DonutBreakdownChart
                  segments={costSegments}
                  centerLabel={fmt(data.costs.totalRecordedOperatingCostsCents, currency)}
                  centerSubtitle="Total costs"
                  size={96}
                  strokeWidth={8.5}
                  showLegend={true}
                  currency={currency}
                />
              </div>
            </div>
          </div>

          {/* Recent expense history row */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-xs">
            {data.costs.expenseHistory.length > 0 ? (
              <span className="text-zinc-600 font-normal truncate max-w-xs">
                Recent: {formatExpenseDate(data.costs.expenseHistory[0].expenseDate)} · {data.costs.expenseHistory[0].category.replace(/_/g, " ")} · {fmt(data.costs.expenseHistory[0].amountCents, currency)}
              </span>
            ) : (
              <span className="text-zinc-400 font-normal">
                No recorded expense history. Recorded costs are never assumed to be zero.
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsExpenseHistoryOpen(true)}
              className="font-medium text-zinc-800 hover:text-amber-800 underline underline-offset-4 cursor-pointer shrink-0 ml-2"
            >
              View all →
            </button>
          </div>
        </div>

        {/* Card 5B: Estimated profit */}
        <div className="flex min-w-0 flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-7">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 20V10M18 20V4M6 20v-4" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-zinc-900">
                Estimated profit
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500 font-normal">
              {data.profit.message}
            </p>

            {/* Waterfall chart component */}
            <FinancialWaterfallChart
              netEarningsCents={data.revenue.netHostEarningsCents}
              recordedCostsCents={data.costs.totalRecordedOperatingCostsCents}
              estimatedProfitCents={data.profit.estimatedOperatingProfitCents}
              profitMarginPercentage={data.profit.profitMarginPercentage}
              currency={currency}
              className="mt-5"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4 text-xs font-normal text-zinc-400">
            <span>Formula: Net host earnings − recorded costs</span>
            <span>Operational estimate</span>
          </div>
        </div>
      </div>

      {/* ── 7. SECTION 6: Source Attribution & Settlement Items ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card 6A: Source attribution */}
        <div className="flex min-w-0 flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-7">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-zinc-900">
                Source attribution
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500 font-normal">
              {data.bookingSources.message}
            </p>

            <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
              {/* Unattributed Donut */}
              <div className="shrink-0">
                <DonutBreakdownChart
                  segments={[
                    {
                      label: "Unattributed",
                      percentage: unattributedPercentage ?? 0,
                      color: "#F5D061",
                    },
                  ]}
                  centerLabel={unattributedPercentage === null ? "—" : `${unattributedPercentage}%`}
                  centerSubtitle="Unattributed"
                  size={96}
                  strokeWidth={9}
                />
              </div>

              <div className="w-full min-w-0 flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#F5D061]" />
                    <span className="font-medium text-zinc-900">Unattributed</span>
                  </div>
                  <span className="font-medium text-zinc-900">
                    {unattributedPercentage === null ? "—" : `${unattributedPercentage}%`}
                  </span>
                </div>
                {unattributedPercentage === null ? (
                  <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                    No eligible completed stays are available for this selected scope.
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                    {unattributedSource?.qualifyingBookingsCount ?? 0} eligible completed stay{unattributedSource?.qualifyingBookingsCount === 1 ? "" : "s"} · {fmt(unattributedSource?.eligibleAccommodationRevenueCents ?? 0, currency)} accommodation · {fmt(unattributedSource?.netHostEarningsCents ?? 0, currency)} net
                  </p>
                )}

                <div className="rounded-xl bg-zinc-50 p-2.5 border border-zinc-100 text-[11px] text-zinc-500 font-normal">
                  Detailed source attribution isn&apos;t recorded on these reservations. Channel attribution is never artificially assigned.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 text-xs text-zinc-400 font-normal">
            Status: Unattributed booking data
          </div>
        </div>

        {/* Card 6B: Eligible settlement items */}
        <div className="flex min-w-0 flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-7">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-zinc-900">
                Eligible settlement items
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500 font-normal">
              {data.payoutBreakdown.message}
            </p>

            {/* Settlement Progress Bars */}
            <div className="mt-5 space-y-3">
              {[
                { label: "Accommodation", value: data.payoutBreakdown.accommodationCents, color: "bg-amber-400" },
                { label: "Cleaning fees", value: data.payoutBreakdown.cleaningFeesCents, color: "bg-amber-500" },
                { label: "Host service fees", value: data.payoutBreakdown.hostServiceFeesCents, color: "bg-zinc-400" },
                { label: "Host-collected taxes", value: data.payoutBreakdown.taxesCollectedForHostCents, color: "bg-zinc-300" },
                { label: "Net host payout", value: data.payoutBreakdown.netHostPayoutCents, color: "bg-[#1A1A1A]" },
              ].map((item, idx) => {
                const pct = Math.min(100, Math.max(3, (item.value / maxSettlementItem) * 100));
                return (
                  <div key={idx} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className="truncate font-normal text-zinc-600">
                      {item.label}
                    </span>
                    <span className="text-right font-medium text-zinc-950">
                      {fmt(item.value, currency)}
                    </span>
                    <div className="col-span-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${item.color}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-xs">
            <span className="text-zinc-400 font-normal">
              Immutable eligible payout snapshots
            </span>
            <Link
              href="/host/earnings/transactions"
              className="font-medium text-zinc-800 hover:text-amber-800 underline underline-offset-4 cursor-pointer"
            >
              View earning transactions →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 8. SECTION 7: Your Listings Compared Table (Search properties, Rows per page) ── */}
      <PropertyComparisonTable
        properties={data.properties}
        currency={currency}
        pagination={data.propertyPagination}
        summary={data.propertySummary}
        selectedStatus={params.get("propertyStatus") || "all"}
        selectedSort={params.get("propertySort") || "net"}
        searchQuery={params.get("propertySearch") || ""}
        analyticsQuery={params.toString()}
        onFilterChange={update}
      />

      {/* ── 9. Modals & Drawers ── */}
      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        listings={data.listings}
        selectedListingId={data.selectedListingId}
        currency={currency}
        onSuccess={refreshExpenses}
      />

      {/* Expense History Drawer */}
      <ExpenseHistoryDrawer
        isOpen={isExpenseHistoryOpen}
        onClose={() => setIsExpenseHistoryOpen(false)}
        expenses={data.costs.expenseHistory}
        listings={data.listings}
        currency={currency}
        onExpenseVoided={refreshExpenses}
      />

      {/* Period Comparison Modal */}
      <PeriodComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        currentPeriodLabel={data.reportingPeriod.label}
        currentStartDate={data.reportingPeriod.startDateKey}
        currentEndDate={data.reportingPeriod.endDateKey}
        currentTimeframe={analyticsTimeframe}
        onApplyComparison={handleComparison}
      />
    </div>
  );
}
